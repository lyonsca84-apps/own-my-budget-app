// Server-only typed client for OpenRouter's Decisions API (Jev). Never
// imported by anything outside supabase/functions — the OPENROUTER_API_KEY
// is read exclusively via Deno.env here and never echoed in any response or
// log line. Request/response shapes below match OpenRouter's documented
// Decisions API (https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request):
//   POST /api/alpha/decisions
//   body: { model, state, questions: { [key]: { type: 'choice', instructions, criteria } } }
//   -> { id, model, provider, answers: { [key]: { type, choice, confidence, probabilities } }, usage: { input_tokens, output_tokens, cost } }
import {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  evaluateCircuitBreaker,
  initialCircuitBreakerState,
  recordFailure,
  recordSuccess,
  type CircuitBreakerState,
} from './circuit-breaker.ts';
import {
  isValidConfidence,
  isValidDecisionValue,
  JEV_WORKFLOWS,
  type JevWorkflowName,
} from './jev-decisions.ts';

const DECISIONS_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
const JEV_MODEL = 'typesafe/jev-1.13';
const REQUEST_TIMEOUT_MS = 8_000;
/** Caps the (already-redacted) text sent to Jev — defense against an oversized request padding cost/latency. */
const MAX_INPUT_LENGTH = 4_000;

// Module-scope — persists only across requests handled by the same warm
// Edge Function instance; resets on cold start. See circuit-breaker.ts's
// doc comment for why this is a secondary safeguard, not the durable one.
let circuitState: CircuitBreakerState = initialCircuitBreakerState();

export interface JevDecisionRequest {
  workflow: JevWorkflowName;
  /** Already redacted by the caller — this client does not re-redact. */
  input: string;
  requestId: string;
}

export type JevDecisionFailureReason =
  | 'disabled'
  | 'circuit_open'
  | 'timeout'
  | 'invalid_response'
  | 'rate_limited'
  | 'network_error'
  | 'http_error'
  | 'not_configured'
  | 'input_too_long'
  | 'unknown_workflow';

export type JevDecisionResponse =
  | {
      ok: true;
      value: string;
      confidence: number;
      model: string;
      latencyMs: number;
      tokensUsed?: number;
      costUsd?: number;
    }
  | { ok: false; reason: JevDecisionFailureReason; detail?: string };

/** Never throws — every failure path returns `{ ok: false, reason }` so callers always have a safe fallback to take. */
export async function callJevDecision(req: JevDecisionRequest): Promise<JevDecisionResponse> {
  const workflow = JEV_WORKFLOWS[req.workflow];
  if (!workflow) {
    return { ok: false, reason: 'unknown_workflow' };
  }
  if (req.input.length > MAX_INPUT_LENGTH) {
    return { ok: false, reason: 'input_too_long' };
  }

  const now = Date.now();
  const gate = evaluateCircuitBreaker(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, now);
  circuitState = gate.nextState;
  if (!gate.allowed) {
    logSafe('jev_circuit_open', req, 0);
    return { ok: false, reason: 'circuit_open' };
  }

  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('jev-client: OPENROUTER_API_KEY is not set.');
    return { ok: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(DECISIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: JEV_MODEL,
        state: req.input,
        questions: {
          [req.workflow]: {
            type: 'choice',
            instructions: workflow.instructions,
            criteria: workflow.criteria,
          },
        },
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (res.status === 429) {
      circuitState = recordFailure(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, Date.now());
      logSafe('jev_rate_limited', req, latencyMs, { httpStatus: res.status });
      return { ok: false, reason: 'rate_limited' };
    }
    if (!res.ok) {
      circuitState = recordFailure(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, Date.now());
      logSafe('jev_http_error', req, latencyMs, { httpStatus: res.status });
      return { ok: false, reason: 'http_error', detail: `status ${res.status}` };
    }

    const body = await res.json();
    const answer = body?.answers?.[req.workflow];
    const value = answer?.choice;
    const confidence = answer?.confidence;
    const model = typeof body?.model === 'string' ? body.model : JEV_MODEL;
    const tokensUsed =
      typeof body?.usage?.input_tokens === 'number' &&
      typeof body?.usage?.output_tokens === 'number'
        ? body.usage.input_tokens + body.usage.output_tokens
        : undefined;
    const costUsd = typeof body?.usage?.cost === 'number' ? body.usage.cost : undefined;

    if (!isValidDecisionValue(workflow.decisionKind, value) || !isValidConfidence(confidence)) {
      circuitState = recordFailure(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, Date.now());
      logSafe('jev_invalid_response', req, latencyMs);
      return { ok: false, reason: 'invalid_response' };
    }

    circuitState = recordSuccess();
    logSafe('jev_success', req, latencyMs, { confidence, decisionStatus: 'pass' });
    return { ok: true, value, confidence, model, latencyMs, tokensUsed, costUsd };
  } catch (error) {
    circuitState = recordFailure(circuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG, Date.now());
    const latencyMs = Date.now() - startedAt;
    const reason: JevDecisionFailureReason =
      error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network_error';
    logSafe(reason === 'timeout' ? 'jev_timeout' : 'jev_network_error', req, latencyMs);
    return { ok: false, reason };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Deliberately whitelists exactly these fields — never spreads the raw
 * request or response body, so a raw prompt, financial message, or API key
 * can never leak into a log line even by accident. `req.input` (the
 * already-redacted text sent to Jev) is intentionally excluded too: this
 * logs that a call happened and how it went, never what was said.
 */
function logSafe(
  event: string,
  req: JevDecisionRequest,
  latencyMs: number,
  fields?: { confidence?: number; httpStatus?: number; decisionStatus?: string }
): void {
  console.log(
    JSON.stringify({
      event,
      requestId: req.requestId,
      workflow: req.workflow,
      latencyMs,
      confidence: fields?.confidence,
      httpStatus: fields?.httpStatus,
      decisionStatus: fields?.decisionStatus,
    })
  );
}
