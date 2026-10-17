// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/circuitBreaker.ts — see jev-decisions.ts for
// why. Held as a module-level variable in jev-client.ts; resets on cold
// start (see that file's comment on why this is a secondary safeguard, not
// the durable kill switch — the JEV_* feature flags are that).

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
  return { allowed: true, nextState: state };
}
