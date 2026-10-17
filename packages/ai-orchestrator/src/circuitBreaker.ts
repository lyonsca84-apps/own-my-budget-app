/**
 * Pure closed/open/half-open circuit-breaker state machine for the Jev
 * client. Edge Function instances are short-lived and stateless across
 * cold starts, so an in-memory breaker (held as a module-level variable at
 * the Deno call site) only protects a single warm instance during a burst
 * of failures — it resets on cold start. The JEV_ORCHESTRATOR_ENABLED /
 * JEV_VOICE_ROUTING_ENABLED feature flags remain the durable, authoritative
 * kill switch; this breaker is a secondary, automatic safeguard on top of
 * them, not a replacement.
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  openDurationMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  openDurationMs: 30_000,
};

export function initialCircuitBreakerState(): CircuitBreakerState {
  return { state: 'closed', consecutiveFailures: 0 };
}

export function recordSuccess(): CircuitBreakerState {
  return { state: 'closed', consecutiveFailures: 0 };
}

export function recordFailure(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig,
  now: number
): CircuitBreakerState {
  const consecutiveFailures = state.consecutiveFailures + 1;
  if (state.state === 'half_open') {
    // The half-open trial request failed — reopen immediately rather than
    // waiting for the failure threshold to accumulate again.
    return { state: 'open', consecutiveFailures, openedAt: now };
  }
  if (consecutiveFailures >= config.failureThreshold) {
    return { state: 'open', consecutiveFailures, openedAt: now };
  }
  return { ...state, consecutiveFailures };
}

export interface CircuitBreakerDecision {
  allowed: boolean;
  nextState: CircuitBreakerState;
}

/** Pure: given the current state and "now" (caller-supplied, for determinism), decides whether a request may proceed. */
export function evaluateCircuitBreaker(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig,
  now: number
): CircuitBreakerDecision {
  if (state.state === 'closed') {
    return { allowed: true, nextState: state };
  }
  if (state.state === 'open') {
    if (state.openedAt !== undefined && now - state.openedAt >= config.openDurationMs) {
      return {
        allowed: true,
        nextState: { state: 'half_open', consecutiveFailures: state.consecutiveFailures },
      };
    }
    return { allowed: false, nextState: state };
  }
  // half_open: allow exactly one trial request through; recordSuccess/recordFailure resolves it.
  return { allowed: true, nextState: state };
}
