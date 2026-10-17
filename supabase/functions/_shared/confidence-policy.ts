// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/confidencePolicy.ts — see jev-decisions.ts
// for why. Thresholds are NOT yet calibrated against real Own My Budget
// usage; see that file's doc comment for the same caveat.
import type { JevDecisionKind } from './jev-decisions.ts';

export interface ConfidenceThresholds {
  low: number;
  high: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: Record<JevDecisionKind, ConfidenceThresholds> = {
  user_intent: { low: 0.5, high: 0.85 },
  expense_category: { low: 0.5, high: 0.85 },
  workflow_status: { low: 0.6, high: 0.9 },
  safety_classification: { low: 0.4, high: 0.75 },
};

export type ConfidenceBand = 'low' | 'medium' | 'high';
export type SuggestedAction = 'clarify' | 'suggest' | 'preselect';

export interface ConfidencePolicyOutcome {
  band: ConfidenceBand;
  action: SuggestedAction;
  requiresUserConfirmation: boolean;
}

export function applyConfidencePolicy(
  confidence: number,
  thresholds: ConfidenceThresholds,
  isConsequential: boolean
): ConfidencePolicyOutcome {
  const band: ConfidenceBand =
    confidence < thresholds.low ? 'low' : confidence < thresholds.high ? 'medium' : 'high';
  const action: SuggestedAction =
    band === 'low' ? 'clarify' : band === 'medium' ? 'suggest' : 'preselect';
  return { band, action, requiresUserConfirmation: isConsequential || band !== 'high' };
}
