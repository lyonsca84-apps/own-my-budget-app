import type { JevDecisionKind } from './types';

export type ConfidenceBand = 'low' | 'medium' | 'high';

export interface ConfidenceThresholds {
  /** Below this: low confidence. */
  low: number;
  /** At or above this: high confidence. Between `low` and `high`: medium. */
  high: number;
}

/**
 * Starting thresholds for observation mode — NOT yet calibrated against
 * real Own My Budget usage. Thresholds must be calibrated using labeled
 * Own My Budget examples before any workflow leaves observation mode; treat
 * every number below as a conservative placeholder (biased toward "ask the
 * user" over "guess") until that calibration happens. Configurable per
 * workflow without touching any orchestration code — add or edit an entry
 * here only.
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: Record<JevDecisionKind, ConfidenceThresholds> = {
  user_intent: { low: 0.5, high: 0.85 },
  expense_category: { low: 0.5, high: 0.85 },
  workflow_status: { low: 0.6, high: 0.9 },
  safety_classification: { low: 0.4, high: 0.75 },
};

export function classifyConfidence(
  confidence: number,
  thresholds: ConfidenceThresholds
): ConfidenceBand {
  if (confidence < thresholds.low) return 'low';
  if (confidence < thresholds.high) return 'medium';
  return 'high';
}

export type SuggestedAction = 'clarify' | 'suggest' | 'preselect';

export interface ConfidencePolicyOutcome {
  band: ConfidenceBand;
  /** low -> ask the user to clarify; medium -> show as a suggestion; high -> may preselect a reversible option. */
  action: SuggestedAction;
  /**
   * Whether the user must explicitly confirm before anything happens.
   * Always true for a consequential (financial-write) action regardless of
   * confidence band — "no financial record may be saved without user
   * confirmation" is a hard rule, not something a confidence score can
   * override.
   */
  requiresUserConfirmation: boolean;
}

export function applyConfidencePolicy(
  confidence: number,
  thresholds: ConfidenceThresholds,
  isConsequential: boolean
): ConfidencePolicyOutcome {
  const band = classifyConfidence(confidence, thresholds);
  const action: SuggestedAction =
    band === 'low' ? 'clarify' : band === 'medium' ? 'suggest' : 'preselect';
  return {
    band,
    action,
    requiresUserConfirmation: isConsequential || band !== 'high',
  };
}
