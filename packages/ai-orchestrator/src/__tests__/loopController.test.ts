import { decideNextLoopAction } from '../loopController';

const MAX = 3;

describe('decideNextLoopAction — terminal signals (never loop further)', () => {
  it('pass resolves immediately', () => {
    expect(decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'pass')).toEqual({
      action: 'pass',
    });
  });

  it('needs_user_confirmation resolves immediately', () => {
    expect(
      decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'needs_user_confirmation')
    ).toEqual({ action: 'needs_user_confirmation' });
  });

  it('needs_human_review resolves immediately, with a reason', () => {
    const result = decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'needs_human_review');
    expect(result).toEqual({ action: 'needs_human_review', reason: 'jev_requested_human_review' });
  });

  it('unsupported resolves to needs_human_review', () => {
    expect(decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'unsupported')).toEqual({
      action: 'needs_human_review',
      reason: 'unsupported_workflow',
    });
  });

  it('error resolves to needs_human_review — never silently retried as if nothing happened', () => {
    expect(decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'error')).toEqual({
      action: 'needs_human_review',
      reason: 'error',
    });
  });

  it('low_confidence resolves to needs_human_review, even on iteration 1', () => {
    expect(decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'low_confidence')).toEqual({
      action: 'needs_human_review',
      reason: 'low_confidence',
    });
  });
});

describe('decideNextLoopAction — revise and the three-attempt maximum', () => {
  it('revise continues the loop while attempts remain', () => {
    expect(decideNextLoopAction({ iteration: 1, maxLoops: MAX }, 'revise')).toEqual({
      action: 'revise',
    });
    expect(decideNextLoopAction({ iteration: 2, maxLoops: MAX }, 'revise')).toEqual({
      action: 'revise',
    });
  });

  it('revise on the final allowed iteration stops the loop instead of continuing', () => {
    expect(decideNextLoopAction({ iteration: 3, maxLoops: MAX }, 'revise')).toEqual({
      action: 'max_loops_reached',
    });
  });

  it('never permits more than maxLoops attempts even if iteration somehow exceeds it', () => {
    expect(decideNextLoopAction({ iteration: 4, maxLoops: MAX }, 'revise')).toEqual({
      action: 'max_loops_reached',
    });
  });

  it('respects a configured maxLoops other than the default', () => {
    expect(decideNextLoopAction({ iteration: 1, maxLoops: 1 }, 'revise')).toEqual({
      action: 'max_loops_reached',
    });
  });
});
