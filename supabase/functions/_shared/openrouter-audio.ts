// Server-only client for OpenRouter's two audio endpoints, used by Budget
// Buddy voice. Like jev-client.ts, OPENROUTER_API_KEY is read exclusively
// via Deno.env here and never echoed in a response or a log line.
//
// Request/response shapes verified against OpenRouter's docs on 2026-10-04:
//   POST /api/v1/audio/transcriptions  (docs/guides/overview/multimodal/stt)
//     JSON body { model, input_audio: { data: <base64>, format }, language }
//     -> JSON { text, usage?: { seconds?, cost? } }
//   POST /api/v1/audio/speech          (docs/guides/overview/multimodal/tts)
//     JSON body { model, input, voice, response_format: 'mp3' | 'pcm', provider? }
//     -> raw audio bytes (audio/mpeg, or audio/pcm;rate=...), NOT JSON, and
//        with no usage/cost in the response — speech cost is always an estimate.
//
// These are NOT drop-in OpenAI shapes: transcription takes base64 JSON
// (`input_audio`), speech only offers mp3/pcm, and a tone instruction is a
// per-provider option under `provider.options.<provider slug>`.
import {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  evaluateCircuitBreaker,
  initialCircuitBreakerState,
  recordFailure,
  recordSuccess,
  type CircuitBreakerState,
} from './circuit-breaker.ts';
import {
  VoiceProviderError,
  type VoiceAudioFormat,
  type VoiceSpeech,
  type VoiceSpeechFormat,
  type VoiceTranscription,
} from './voice-core.ts';

const TRANSCRIPTIONS_ENDPOINT = 'https://openrouter.ai/api/v1/audio/transcriptions';
const SPEECH_ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';

// Module-scope, so it only spans requests served by the same warm instance
// (see circuit-breaker.ts). It stops a burst of calls into a provider that
// is already failing; the durable spend guard is the ledger's monthly budget.
let circuitState: CircuitBreakerState = initialCircuitBreakerState();

function noteFailure(): void {
  circuitState = recordFailure(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, Date.now());
}

/**
 * One attempt, never retried. Aborts on whichever comes first: the timeout,
 * or the caller's own request being cancelled — which is how a customer
 * tapping Cancel reaches the upstream call.
 */
async function postToOpenRouter(
  url: string,
  payload: unknown,
  timeoutMs: number,
  clientSignal: AbortSignal
): Promise<Response> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new VoiceProviderError('not_configured');

  const gate = evaluateCircuitBreaker(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, Date.now());
  circuitState = gate.nextState;
  if (!gate.allowed) throw new VoiceProviderError('circuit_open');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([clientSignal, AbortSignal.timeout(timeoutMs)]),
    });
  } catch (error) {
    // A customer cancelling is not a provider fault — don't count it.
    if (clientSignal.aborted) throw new VoiceProviderError('cancelled');
    noteFailure();
    const name = error instanceof Error ? error.name : '';
    throw new VoiceProviderError(
      name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error'
    );
  }

  if (!res.ok) {
    // The error body is deliberately not read into any log or response.
    await res.body?.cancel();
    // The provider refusing one particular input (unreadable audio, say) is
    // about that request, not the provider's health — it must not trip the
    // breaker, or one person's bad upload would pause voice for everyone.
    if ([400, 413, 415, 422].includes(res.status)) {
      throw new VoiceProviderError('rejected', res.status);
    }
    noteFailure();
    if (res.status === 429) throw new VoiceProviderError('rate_limited', res.status);
    if (res.status === 402) throw new VoiceProviderError('insufficient_credits', res.status);
    if (res.status === 408 || res.status === 504 || res.status === 524) {
      throw new VoiceProviderError('timeout', res.status);
    }
    throw new VoiceProviderError('http_error', res.status);
  }
  return res;
}

export async function transcribeWithOpenRouter(
  args: { base64: string; format: VoiceAudioFormat; model: string; timeoutMs: number },
  clientSignal: AbortSignal
): Promise<VoiceTranscription> {
  const res = await postToOpenRouter(
    TRANSCRIPTIONS_ENDPOINT,
    {
      model: args.model,
      input_audio: { data: args.base64, format: args.format },
      language: 'en',
    },
    args.timeoutMs,
    clientSignal
  );

  let body: { text?: unknown; usage?: { cost?: unknown; seconds?: unknown } };
  try {
    body = await res.json();
  } catch {
    if (clientSignal.aborted) throw new VoiceProviderError('cancelled');
    noteFailure();
    throw new VoiceProviderError('invalid_response');
  }
  if (typeof body?.text !== 'string') {
    noteFailure();
    throw new VoiceProviderError('invalid_response');
  }

  circuitState = recordSuccess();
  return {
    text: body.text,
    costUsd: typeof body.usage?.cost === 'number' ? body.usage.cost : undefined,
    seconds: typeof body.usage?.seconds === 'number' ? body.usage.seconds : undefined,
  };
}

export async function synthesizeWithOpenRouter(
  args: {
    text: string;
    model: string;
    voice: string;
    format: VoiceSpeechFormat;
    style: string;
    timeoutMs: number;
  },
  clientSignal: AbortSignal
): Promise<VoiceSpeech> {
  const res = await postToOpenRouter(
    SPEECH_ENDPOINT,
    {
      model: args.model,
      input: args.text,
      voice: args.voice,
      response_format: args.format,
      // Tone is never written into `input` (most models would read it
      // aloud). OpenRouter forwards only the options block for the provider
      // that actually serves the model, so listing both documented shapes
      // lets BUDDY_VOICE_TTS_MODEL switch providers without a code change.
      provider: {
        options: {
          openai: { instructions: args.style },
          'google-ai-studio': { speech_metadata: { style: args.style } },
        },
      },
    },
    args.timeoutMs,
    clientSignal
  );

  const contentType = res.headers.get('Content-Type') ?? '';
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    if (clientSignal.aborted) throw new VoiceProviderError('cancelled');
    noteFailure();
    throw new VoiceProviderError('network_error');
  }
  // A 200 whose body is JSON rather than audio is an error envelope.
  if (!contentType.toLowerCase().startsWith('audio/') || bytes.length === 0) {
    noteFailure();
    throw new VoiceProviderError('invalid_response');
  }

  circuitState = recordSuccess();
  return { bytes, contentType };
}
