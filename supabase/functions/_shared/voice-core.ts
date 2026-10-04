// Budget Buddy voice (tap-to-talk) — the request handler and every rule it
// enforces, with zero imports and zero I/O: auth, plan lookup, the usage
// ledger, and the OpenRouter calls are all injected as `VoiceDeps`.
//
// This file is the Source of Truth and the one Jest covers.
// supabase/functions/_shared/voice-core.ts is a byte-identical copy (Deno
// Edge Functions can't import npm workspace packages at deploy time) —
// voiceCoreSync.test.ts fails CI if the two ever differ, so edit this file
// and copy it across rather than editing the Deno side.

export type VoicePlanTier = 'free' | 'guided' | 'budgetBuddy';
export type VoiceKind = 'transcription' | 'speech';
export type VoiceAudioFormat = 'webm' | 'ogg' | 'm4a' | 'wav' | 'mp3';
export type VoiceSpeechFormat = 'mp3' | 'pcm';

export interface VoiceConfig {
  /** Kill switch. Off unless BUDDY_VOICE_ENABLED is exactly "true". */
  enabled: boolean;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  ttsFormat: VoiceSpeechFormat;
  /** Delivery direction, sent only through the provider's documented tone option. */
  ttsStyle: string;
  maxRecordingSeconds: number;
  maxAudioBytes: number;
  /** Longest text sent for speech; a longer reply is cut at a sentence end (the full text still shows). */
  maxSpeechChars: number;
  sttTimeoutMs: number;
  ttsTimeoutMs: number;
  /** Per user, per kind, counting every attempt in the last 60 seconds. */
  rateLimitPerMinute: number;
  /** Whole-app ceiling on voice provider spend per UTC calendar month. */
  monthlyBudgetMicroUsd: number;
  monthlyLimits: Record<VoiceKind, Record<VoicePlanTier, number>>;
  /** Used only when the provider reports no cost — recorded as an estimate, never as fact. */
  sttUsdPerMinuteEstimate: number;
  ttsUsdPerCharEstimate: number;
}

export const VOICE_HARD_MAX_RECORDING_SECONDS = 60;
/** Slack for the gap between the client's timer and the encoder flushing its last chunk. */
const DURATION_GRACE_MS = 1500;
const MIN_RECORDING_MS = 300;
const MIN_AUDIO_BYTES = 200;
const MAX_TRANSCRIPT_CHARS = 2000;
const MAX_SPEECH_INPUT_CHARS = 4000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

type EnvReader = (name: string) => string | undefined;

function readNumber(
  getEnv: EnvReader,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = getEnv(name);
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readInt(
  getEnv: EnvReader,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  return Math.floor(readNumber(getEnv, name, fallback, min, max));
}

function readString(getEnv: EnvReader, name: string, fallback: string): string {
  const raw = getEnv(name)?.trim();
  return raw ? raw : fallback;
}

/**
 * Every knob is server-side environment configuration with a conservative
 * default, so an unset variable never widens access or spend. Numbers are
 * clamped — a typo can't remove a limit.
 */
export function readVoiceConfig(getEnv: EnvReader): VoiceConfig {
  return {
    enabled: getEnv('BUDDY_VOICE_ENABLED')?.trim().toLowerCase() === 'true',
    sttModel: readString(getEnv, 'BUDDY_VOICE_STT_MODEL', 'openai/gpt-4o-mini-transcribe'),
    ttsModel: readString(getEnv, 'BUDDY_VOICE_TTS_MODEL', 'microsoft/mai-voice-2.1-flash'),
    ttsVoice: readString(getEnv, 'BUDDY_VOICE_TTS_VOICE', 'en-US-Harper:MAI-Voice-2.1-Flash'),
    ttsFormat: getEnv('BUDDY_VOICE_TTS_FORMAT')?.trim().toLowerCase() === 'pcm' ? 'pcm' : 'mp3',
    ttsStyle: readString(
      getEnv,
      'BUDDY_VOICE_TTS_STYLE',
      'Warm, calm, encouraging and plain-spoken, at an unhurried pace.'
    ),
    maxRecordingSeconds: readInt(
      getEnv,
      'BUDDY_VOICE_MAX_RECORDING_SECONDS',
      VOICE_HARD_MAX_RECORDING_SECONDS,
      5,
      VOICE_HARD_MAX_RECORDING_SECONDS
    ),
    maxAudioBytes: readInt(getEnv, 'BUDDY_VOICE_MAX_AUDIO_BYTES', 2_000_000, 50_000, 8_000_000),
    maxSpeechChars: readInt(getEnv, 'BUDDY_VOICE_MAX_REPLY_CHARS', 600, 100, 2000),
    sttTimeoutMs: readInt(getEnv, 'BUDDY_VOICE_STT_TIMEOUT_MS', 30_000, 3_000, 60_000),
    ttsTimeoutMs: readInt(getEnv, 'BUDDY_VOICE_TTS_TIMEOUT_MS', 30_000, 3_000, 60_000),
    rateLimitPerMinute: readInt(getEnv, 'BUDDY_VOICE_RATE_LIMIT_PER_MINUTE', 6, 1, 60),
    monthlyBudgetMicroUsd: Math.round(
      readNumber(getEnv, 'BUDDY_VOICE_MONTHLY_BUDGET_USD', 25, 0, 100_000) * 1_000_000
    ),
    monthlyLimits: {
      transcription: {
        free: readInt(getEnv, 'BUDDY_VOICE_MONTHLY_TURNS_FREE', 0, 0, 100_000),
        guided: readInt(getEnv, 'BUDDY_VOICE_MONTHLY_TURNS_GUIDED', 20, 0, 100_000),
        budgetBuddy: readInt(getEnv, 'BUDDY_VOICE_MONTHLY_TURNS_BUDGET_BUDDY', 100, 0, 100_000),
      },
      speech: {
        free: readInt(getEnv, 'BUDDY_VOICE_MONTHLY_SPOKEN_REPLIES_FREE', 0, 0, 100_000),
        guided: readInt(getEnv, 'BUDDY_VOICE_MONTHLY_SPOKEN_REPLIES_GUIDED', 40, 0, 100_000),
        budgetBuddy: readInt(
          getEnv,
          'BUDDY_VOICE_MONTHLY_SPOKEN_REPLIES_BUDGET_BUDDY',
          200,
          0,
          100_000
        ),
      },
    },
    sttUsdPerMinuteEstimate: readNumber(getEnv, 'BUDDY_VOICE_STT_USD_PER_MINUTE', 0.003, 0, 10),
    ttsUsdPerCharEstimate: readNumber(getEnv, 'BUDDY_VOICE_TTS_USD_PER_CHAR', 0.000015, 0, 1),
  };
}

/** Identifies a recording by its leading bytes — the client's claimed MIME type is never trusted. */
export function detectAudioFormat(bytes: Uint8Array): VoiceAudioFormat | null {
  if (bytes.length < 12) return null;
  const ascii = (start: number, text: string) =>
    [...text].every((char, i) => bytes[start + i] === char.charCodeAt(0));

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'webm';
  }
  if (ascii(0, 'OggS')) return 'ogg';
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'wav';
  if (ascii(4, 'ftyp')) return 'm4a';
  if (ascii(0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Raw 16-bit little-endian mono PCM (what `response_format: "pcm"` returns) wrapped so a browser can play it. */
export function wrapPcmAsWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const wav = new Uint8Array(44 + pcm.length);
  const view = new DataView(wav.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);
  return wav;
}

/** Reads `rate=` from a Content-Type like `audio/pcm;rate=24000;channels=1`. */
export function pcmSampleRate(contentType: string | null | undefined): number {
  const match = /rate=(\d{4,6})/i.exec(contentType ?? '');
  return match ? Number(match[1]) : 24000;
}

/**
 * Makes a chat reply safe to read aloud: drops markdown marks a voice would
 * stumble over, and keeps it within the configured length by ending at the
 * last whole sentence that fits.
 */
export function prepareSpeechText(
  text: string,
  maxChars: number
): { text: string; truncated: boolean } {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxChars) return { text: cleaned, truncated: false };

  const window = cleaned.slice(0, maxChars);
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! ')
  );
  if (sentenceEnd >= maxChars * 0.4) {
    return { text: window.slice(0, sentenceEnd + 1), truncated: true };
  }
  const wordEnd = window.lastIndexOf(' ');
  return { text: window.slice(0, wordEnd > 0 ? wordEnd : maxChars).trim(), truncated: true };
}

export type VoiceErrorCode =
  | 'unauthorized'
  | 'voice_disabled'
  | 'voice_not_in_plan'
  | 'usage_limit'
  | 'rate_limited'
  | 'duplicate_request'
  | 'voice_budget_reached'
  | 'invalid_request'
  | 'recording_too_short'
  | 'recording_too_long'
  | 'recording_too_large'
  | 'unsupported_audio'
  | 'unreadable_recording'
  | 'no_speech'
  | 'cancelled'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'server_error';

const STATUS_BY_CODE: Record<VoiceErrorCode, number> = {
  unauthorized: 401,
  voice_disabled: 403,
  voice_not_in_plan: 403,
  usage_limit: 403,
  rate_limited: 429,
  duplicate_request: 409,
  voice_budget_reached: 503,
  invalid_request: 400,
  recording_too_short: 400,
  recording_too_long: 400,
  recording_too_large: 413,
  unsupported_audio: 415,
  unreadable_recording: 422,
  no_speech: 422,
  cancelled: 499,
  provider_timeout: 504,
  provider_unavailable: 502,
  server_error: 500,
};

/** Customer-facing wording. Never includes provider detail, and never promises unlimited voice. */
const MESSAGE_BY_CODE: Record<VoiceErrorCode, string> = {
  unauthorized: 'Please sign in again to talk with Budget Buddy.',
  voice_disabled: 'Talking with Budget Buddy isn’t switched on yet. You can still type.',
  voice_not_in_plan:
    'Talking with Budget Buddy is part of the paid plans. You can still type your question.',
  usage_limit:
    'You’ve used this month’s voice allowance. It resets next month — you can still type your question.',
  rate_limited: 'That was a lot of voice messages in a row. Give it a minute, or type instead.',
  duplicate_request: 'That one is already on its way.',
  voice_budget_reached: 'Voice is taking a short break. You can still type your question.',
  invalid_request: 'That voice request didn’t look right. Please try again.',
  recording_too_short: 'That was too short to hear. Hold on a little longer and try again.',
  recording_too_long: 'That recording was over the limit. Try a shorter question.',
  recording_too_large: 'That recording was too big to send. Try a shorter question.',
  unsupported_audio:
    'This browser recorded in a format Budget Buddy can’t read. You can type instead.',
  unreadable_recording:
    'I couldn’t make sense of that recording. Please try again, or type your question.',
  no_speech: 'I couldn’t make out any words. Try again somewhere quieter, or type instead.',
  cancelled: 'Cancelled.',
  provider_timeout: 'That took too long. Please try again, or type instead.',
  provider_unavailable: 'Voice isn’t available right now. You can still type your question.',
  server_error: 'Something went wrong with voice. You can still type your question.',
};

export interface VoiceResult {
  status: number;
  body: Record<string, unknown>;
}

function fail(code: VoiceErrorCode): VoiceResult {
  return { status: STATUS_BY_CODE[code], body: { error: MESSAGE_BY_CODE[code], code } };
}

export class VoiceAuthError extends Error {}

export type VoiceProviderFailure =
  | 'timeout'
  | 'cancelled'
  | 'rate_limited'
  | 'insufficient_credits'
  /** The provider refused this particular input (a 4xx) — the caller's content, not an outage. */
  | 'rejected'
  | 'http_error'
  | 'network_error'
  | 'invalid_response'
  | 'circuit_open'
  | 'not_configured';

export class VoiceProviderError extends Error {
  constructor(
    public readonly reason: VoiceProviderFailure,
    public readonly httpStatus?: number
  ) {
    super(`Voice provider call failed: ${reason}`);
  }
}

export type VoiceReserveOutcome = 'reserved' | 'duplicate' | 'limit' | 'rate_limited' | 'budget';

export interface VoiceReserveArgs {
  userId: string;
  kind: VoiceKind;
  requestId: string;
  monthlyLimit: number;
  rateLimitPerMinute: number;
  estimatedCostMicroUsd: number;
  monthlyBudgetMicroUsd: number;
}

export interface VoiceReserveResult {
  outcome: VoiceReserveOutcome;
  ledgerId?: string;
  /** This kind's count for the month, including the row just reserved. */
  usedCount?: number;
}

export interface VoiceFinalizeArgs {
  /** `failed` hands the allowance back; `cancelled` keeps it, since the provider may already have charged. */
  status: 'completed' | 'failed' | 'cancelled';
  costMicroUsd: number;
  costSource: 'reported' | 'estimated';
  audioSeconds?: number;
  characters?: number;
  model: string;
}

export interface VoiceTranscription {
  text: string;
  /** Present only when the provider reported it. */
  costUsd?: number;
  seconds?: number;
}

export interface VoiceSpeech {
  bytes: Uint8Array;
  contentType: string;
}

export interface VoiceDeps {
  config: VoiceConfig;
  /** Resolves the caller from their verified session. Throws VoiceAuthError otherwise. */
  authenticate(): Promise<string>;
  getPlanTier(userId: string): Promise<VoicePlanTier>;
  getMonthlyUsage(userId: string): Promise<Record<VoiceKind, number>>;
  /** Must be atomic: checks duplicate, allowance, rate and budget, and records the reservation, in one transaction. */
  reserve(args: VoiceReserveArgs): Promise<VoiceReserveResult>;
  finalize(ledgerId: string, outcome: VoiceFinalizeArgs): Promise<void>;
  transcribe(args: {
    base64: string;
    format: VoiceAudioFormat;
    model: string;
    timeoutMs: number;
  }): Promise<VoiceTranscription>;
  synthesize(args: {
    text: string;
    model: string;
    voice: string;
    format: VoiceSpeechFormat;
    style: string;
    timeoutMs: number;
  }): Promise<VoiceSpeech>;
  /**
   * Metadata only — the handler never passes a transcript, reply text,
   * audio, or budget data to this.
   */
  log(event: string, fields: Record<string, string | number | boolean | undefined>): void;
}

type Validation<T> = { ok: true; value: T } | { ok: false; code: VoiceErrorCode };

interface TranscribeInput {
  requestId: string;
  base64: string;
  format: VoiceAudioFormat;
  durationMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateTranscribeInput(
  body: unknown,
  config: VoiceConfig
): Validation<TranscribeInput> {
  if (!isRecord(body)) return { ok: false, code: 'invalid_request' };
  const { requestId, audioBase64, durationMs } = body;

  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    return { ok: false, code: 'invalid_request' };
  }
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return { ok: false, code: 'invalid_request' };
  }
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    return { ok: false, code: 'invalid_request' };
  }
  // Size is checked from the encoded length first, so an oversized upload is
  // rejected before it is ever decoded into memory.
  if (Math.floor((audioBase64.length * 3) / 4) > config.maxAudioBytes) {
    return { ok: false, code: 'recording_too_large' };
  }
  if (durationMs > config.maxRecordingSeconds * 1000 + DURATION_GRACE_MS) {
    return { ok: false, code: 'recording_too_long' };
  }
  if (durationMs < MIN_RECORDING_MS) return { ok: false, code: 'recording_too_short' };
  if (audioBase64.length % 4 !== 0 || !BASE64_PATTERN.test(audioBase64)) {
    return { ok: false, code: 'invalid_request' };
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(audioBase64);
  } catch {
    return { ok: false, code: 'invalid_request' };
  }
  if (bytes.length < MIN_AUDIO_BYTES) return { ok: false, code: 'recording_too_short' };

  const format = detectAudioFormat(bytes);
  if (!format) return { ok: false, code: 'unsupported_audio' };

  return { ok: true, value: { requestId, base64: audioBase64, format, durationMs } };
}

interface SpeakInput {
  requestId: string;
  text: string;
  truncated: boolean;
}

export function validateSpeakInput(body: unknown, config: VoiceConfig): Validation<SpeakInput> {
  if (!isRecord(body)) return { ok: false, code: 'invalid_request' };
  const { requestId, text } = body;

  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    return { ok: false, code: 'invalid_request' };
  }
  if (typeof text !== 'string' || text.length > MAX_SPEECH_INPUT_CHARS) {
    return { ok: false, code: 'invalid_request' };
  }
  const prepared = prepareSpeechText(text, config.maxSpeechChars);
  if (!prepared.text) return { ok: false, code: 'invalid_request' };

  return { ok: true, value: { requestId, text: prepared.text, truncated: prepared.truncated } };
}

function allowance(limit: number, used: number) {
  return { limit, used, remaining: Math.max(0, limit - used) };
}

const RESERVE_FAILURE_CODE: Record<Exclude<VoiceReserveOutcome, 'reserved'>, VoiceErrorCode> = {
  duplicate: 'duplicate_request',
  limit: 'usage_limit',
  rate_limited: 'rate_limited',
  budget: 'voice_budget_reached',
};

function providerFailureCode(error: VoiceProviderError, kind: VoiceKind): VoiceErrorCode {
  if (error.reason === 'timeout') return 'provider_timeout';
  if (error.reason === 'cancelled') return 'cancelled';
  if (error.reason === 'rejected' && kind === 'transcription') return 'unreadable_recording';
  return 'provider_unavailable';
}

/**
 * Runs one provider call inside a ledger reservation: reserve → call →
 * finalize. A failed call hands the allowance back; a cancelled one keeps
 * it (the provider may already have charged). There is no retry here by
 * design — a retry is always a fresh, explicit request from the customer.
 */
async function withReservation<T>(
  deps: VoiceDeps,
  args: {
    userId: string;
    kind: VoiceKind;
    requestId: string;
    monthlyLimit: number;
    estimatedCostMicroUsd: number;
    model: string;
    audioSeconds?: number;
    characters?: number;
  },
  call: () => Promise<{ value: T; reportedCostUsd?: number; audioSeconds?: number }>
): Promise<{ ok: true; value: T; remaining: number } | { ok: false; result: VoiceResult }> {
  const reservation = await deps.reserve({
    userId: args.userId,
    kind: args.kind,
    requestId: args.requestId,
    monthlyLimit: args.monthlyLimit,
    rateLimitPerMinute: deps.config.rateLimitPerMinute,
    estimatedCostMicroUsd: args.estimatedCostMicroUsd,
    monthlyBudgetMicroUsd: deps.config.monthlyBudgetMicroUsd,
  });
  if (reservation.outcome !== 'reserved' || !reservation.ledgerId) {
    const code =
      reservation.outcome === 'reserved'
        ? 'server_error'
        : RESERVE_FAILURE_CODE[reservation.outcome];
    deps.log('voice_reservation_refused', {
      kind: args.kind,
      requestId: args.requestId,
      outcome: reservation.outcome,
    });
    return { ok: false, result: fail(code) };
  }

  const ledgerId = reservation.ledgerId;
  const startedAt = Date.now();
  const settle = async (outcome: VoiceFinalizeArgs) => {
    try {
      await deps.finalize(ledgerId, outcome);
    } catch {
      // The reservation row stays 'reserved', which still counts against the
      // allowance and the budget — failing closed, never open.
      deps.log('voice_finalize_failed', { kind: args.kind, requestId: args.requestId });
    }
  };

  try {
    const { value, reportedCostUsd, audioSeconds } = await call();
    const reported = typeof reportedCostUsd === 'number' && Number.isFinite(reportedCostUsd);
    await settle({
      status: 'completed',
      costMicroUsd: reported
        ? Math.max(0, Math.round((reportedCostUsd as number) * 1_000_000))
        : args.estimatedCostMicroUsd,
      costSource: reported ? 'reported' : 'estimated',
      audioSeconds: audioSeconds ?? args.audioSeconds,
      characters: args.characters,
      model: args.model,
    });
    deps.log('voice_call_completed', {
      kind: args.kind,
      requestId: args.requestId,
      latencyMs: Date.now() - startedAt,
      costSource: reported ? 'reported' : 'estimated',
    });
    return {
      ok: true,
      value,
      remaining: Math.max(0, args.monthlyLimit - (reservation.usedCount ?? args.monthlyLimit)),
    };
  } catch (error) {
    const cancelled = error instanceof VoiceProviderError && error.reason === 'cancelled';
    await settle({
      status: cancelled ? 'cancelled' : 'failed',
      costMicroUsd: cancelled ? args.estimatedCostMicroUsd : 0,
      costSource: 'estimated',
      audioSeconds: args.audioSeconds,
      characters: args.characters,
      model: args.model,
    });
    if (error instanceof VoiceProviderError) {
      deps.log('voice_call_failed', {
        kind: args.kind,
        requestId: args.requestId,
        latencyMs: Date.now() - startedAt,
        reason: error.reason,
        httpStatus: error.httpStatus,
      });
      return { ok: false, result: fail(providerFailureCode(error, args.kind)) };
    }
    throw error;
  }
}

/**
 * The whole Budget Buddy voice endpoint. Order matters and is fixed:
 * authenticate → kill switch → plan entitlement → validate the upload →
 * atomic reservation → provider. Nothing is reserved, and no provider is
 * called, for a request that fails an earlier step.
 */
export async function handleVoiceRequest(deps: VoiceDeps, body: unknown): Promise<VoiceResult> {
  const { config } = deps;
  try {
    let userId: string;
    try {
      userId = await deps.authenticate();
    } catch (error) {
      if (error instanceof VoiceAuthError) return fail('unauthorized');
      throw error;
    }

    const action = isRecord(body) ? body.action : undefined;
    if (action !== 'status' && action !== 'transcribe' && action !== 'speak') {
      return fail('invalid_request');
    }

    if (action === 'status') {
      if (!config.enabled) return { status: 200, body: { enabled: false } };
      const planTier = await deps.getPlanTier(userId);
      const used = await deps.getMonthlyUsage(userId);
      return {
        status: 200,
        body: {
          enabled: true,
          maxRecordingSeconds: config.maxRecordingSeconds,
          transcription: allowance(
            config.monthlyLimits.transcription[planTier],
            used.transcription
          ),
          speech: allowance(config.monthlyLimits.speech[planTier], used.speech),
        },
      };
    }

    if (!config.enabled) return fail('voice_disabled');

    const kind: VoiceKind = action === 'transcribe' ? 'transcription' : 'speech';
    const planTier = await deps.getPlanTier(userId);
    const monthlyLimit = config.monthlyLimits[kind][planTier];
    if (monthlyLimit <= 0) return fail('voice_not_in_plan');

    if (action === 'transcribe') {
      const input = validateTranscribeInput(body, config);
      if (!input.ok) return fail(input.code);
      const { requestId, base64, format, durationMs } = input.value;

      const outcome = await withReservation(
        deps,
        {
          userId,
          kind,
          requestId,
          monthlyLimit,
          estimatedCostMicroUsd: Math.ceil(
            (durationMs / 60_000) * config.sttUsdPerMinuteEstimate * 1_000_000
          ),
          model: config.sttModel,
          audioSeconds: durationMs / 1000,
        },
        async () => {
          const transcription = await deps.transcribe({
            base64,
            format,
            model: config.sttModel,
            timeoutMs: config.sttTimeoutMs,
          });
          return {
            value: transcription.text,
            reportedCostUsd: transcription.costUsd,
            audioSeconds: transcription.seconds,
          };
        }
      );
      if (!outcome.ok) return outcome.result;

      const transcript = outcome.value.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT_CHARS);
      // The transcription itself succeeded (and was billed), so the allowance
      // stays spent even when there were no words in it.
      if (!transcript) return fail('no_speech');
      return { status: 200, body: { transcript, remaining: outcome.remaining } };
    }

    const input = validateSpeakInput(body, config);
    if (!input.ok) return fail(input.code);
    const { requestId, text, truncated } = input.value;

    const outcome = await withReservation(
      deps,
      {
        userId,
        kind,
        requestId,
        monthlyLimit,
        estimatedCostMicroUsd: Math.ceil(text.length * config.ttsUsdPerCharEstimate * 1_000_000),
        model: config.ttsModel,
        characters: text.length,
      },
      async () => {
        const speech = await deps.synthesize({
          text,
          model: config.ttsModel,
          voice: config.ttsVoice,
          format: config.ttsFormat,
          style: config.ttsStyle,
          timeoutMs: config.ttsTimeoutMs,
        });
        if (speech.bytes.length === 0) throw new VoiceProviderError('invalid_response');
        return { value: speech };
      }
    );
    if (!outcome.ok) return outcome.result;

    const speech = outcome.value;
    const isPcm = config.ttsFormat === 'pcm';
    const audio = isPcm
      ? wrapPcmAsWav(speech.bytes, pcmSampleRate(speech.contentType))
      : speech.bytes;
    return {
      status: 200,
      body: {
        audioBase64: bytesToBase64(audio),
        mimeType: isPcm ? 'audio/wav' : 'audio/mpeg',
        truncated,
        remaining: outcome.remaining,
      },
    };
  } catch (error) {
    deps.log('voice_unexpected_error', {
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    return fail('server_error');
  }
}
