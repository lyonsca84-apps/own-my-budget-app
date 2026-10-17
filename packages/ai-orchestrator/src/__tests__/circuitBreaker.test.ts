import {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  evaluateCircuitBreaker,
  initialCircuitBreakerState,
  recordFailure,
  recordSuccess,
} from '../circuitBreaker';

const CONFIG = DEFAULT_CIRCUIT_BREAKER_CONFIG; // { failureThreshold: 3, openDurationMs: 30_000 }

describe('circuit breaker — closed state (normal operation)', () => {
  it('starts closed and allows requests', () => {
    const state = initialCircuitBreakerState();
    expect(evaluateCircuitBreaker(state, CONFIG, 0).allowed).toBe(true);
  });

  it('stays closed after fewer failures than the threshold', () => {
    let state = initialCircuitBreakerState();
    state = recordFailure(state, CONFIG, 1000);
    state = recordFailure(state, CONFIG, 1001);
    expect(state.state).toBe('closed');
    expect(evaluateCircuitBreaker(state, CONFIG, 1002).allowed).toBe(true);
  });

  it('a success resets the failure count to zero', () => {
    let state = initialCircuitBreakerState();
    state = recordFailure(state, CONFIG, 1000);
    state = recordFailure(state, CONFIG, 1001);
    state = recordSuccess();
    expect(state).toEqual({ state: 'closed', consecutiveFailures: 0 });
  });
});

describe('circuit breaker — opening (e.g. repeated timeouts, rate limits, or network failures)', () => {
  it('opens after reaching the failure threshold', () => {
    let state = initialCircuitBreakerState();
    state = recordFailure(state, CONFIG, 1000);
    state = recordFailure(state, CONFIG, 1001);
    state = recordFailure(state, CONFIG, 1002);
    expect(state.state).toBe('open');
    expect(state.consecutiveFailures).toBe(3);
    expect(state.openedAt).toBe(1002);
  });

  it('blocks requests while open and before the open duration elapses', () => {
    let state = initialCircuitBreakerState();
    state = recordFailure(state, CONFIG, 0);
    state = recordFailure(state, CONFIG, 0);
    state = recordFailure(state, CONFIG, 0);
    const decision = evaluateCircuitBreaker(state, CONFIG, 5_000);
    expect(decision.allowed).toBe(false);
    expect(decision.nextState.state).toBe('open');
  });
});

describe('circuit breaker — half-open recovery', () => {
  function openedAtZero() {
    let state = initialCircuitBreakerState();
    state = recordFailure(state, CONFIG, 0);
    state = recordFailure(state, CONFIG, 0);
    state = recordFailure(state, CONFIG, 0);
    return state;
  }

  it('transitions to half-open and allows exactly one trial request once the open duration elapses', () => {
    const state = openedAtZero();
    const decision = evaluateCircuitBreaker(state, CONFIG, CONFIG.openDurationMs);
    expect(decision.allowed).toBe(true);
    expect(decision.nextState.state).toBe('half_open');
  });

  it('a successful trial request closes the breaker', () => {
    const state = openedAtZero();
    const { nextState: halfOpen } = evaluateCircuitBreaker(state, CONFIG, CONFIG.openDurationMs);
    const closed = recordSuccess();
    expect(halfOpen.state).toBe('half_open');
    expect(closed).toEqual({ state: 'closed', consecutiveFailures: 0 });
  });

  it('a failed trial request reopens the breaker immediately, without waiting for the threshold again', () => {
    const state = openedAtZero();
    const { nextState: halfOpen } = evaluateCircuitBreaker(state, CONFIG, CONFIG.openDurationMs);
    const reopened = recordFailure(halfOpen, CONFIG, CONFIG.openDurationMs + 1);
    expect(reopened.state).toBe('open');
    expect(reopened.openedAt).toBe(CONFIG.openDurationMs + 1);
  });
});
