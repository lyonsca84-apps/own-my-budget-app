import type { WorkflowStatus } from './types';

export interface LoopState {
  /** 1-based — the attempt that just completed. */
  iteration: number;
  maxLoops: number;
}

export type LoopAction =
  | { action: 'revise' }
  | { action: 'pass' }
  | { action: 'needs_user_confirmation' }
  | { action: 'needs_human_review'; reason: string }
  | { action: 'max_loops_reached' };

/** What the loop controller treats a Jev workflow_status evaluation as, after the caller folds in its own confidence-policy and error handling. */
export type LoopSignal = WorkflowStatus | 'error' | 'low_confidence';

/**
 * Pure decision step for one iteration of the Claude -> protected tool ->
 * Jev evaluation -> (revise?) loop. Never permits more than `maxLoops`
 * total Claude attempts (default 3, see AI_ORCHESTRATOR_MAX_LOOPS) —
 * 'revise' is returned only while a loop is still available to spend on
 * it; every other signal, and running out of loops, resolves to a
 * terminal, safe outcome. Nothing here ever decides to write data — this
 * only ever says what should happen *next* in the conversation.
 */
export function decideNextLoopAction(state: LoopState, signal: LoopSignal): LoopAction {
  switch (signal) {
    case 'pass':
      return { action: 'pass' };
    case 'needs_user_confirmation':
      return { action: 'needs_user_confirmation' };
    case 'needs_human_review':
      return { action: 'needs_human_review', reason: 'jev_requested_human_review' };
    case 'unsupported':
      return { action: 'needs_human_review', reason: 'unsupported_workflow' };
    case 'error':
      return { action: 'needs_human_review', reason: 'error' };
    case 'low_confidence':
      return { action: 'needs_human_review', reason: 'low_confidence' };
    case 'revise':
      if (state.iteration >= state.maxLoops) {
        return { action: 'max_loops_reached' };
      }
      return { action: 'revise' };
  }
}
