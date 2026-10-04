// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/loopController.ts — see jev-decisions.ts for
// why.
import type { WorkflowStatus } from './jev-decisions.ts';

export interface LoopState {
  iteration: number;
  maxLoops: number;
}

export type LoopAction =
  | { action: 'revise' }
  | { action: 'pass' }
  | { action: 'needs_user_confirmation' }
  | { action: 'needs_human_review'; reason: string }
  | { action: 'max_loops_reached' };

export type LoopSignal = WorkflowStatus | 'error' | 'low_confidence';

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
