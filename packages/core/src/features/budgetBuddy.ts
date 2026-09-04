import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanUseBudgetBuddyParams {
  plan: PlanTier;
  /** Budget Buddy actions used so far in the current period (see FEATURE_REGISTRY's `period`). */
  actionsUsed: number;
}

/**
 * Budget Buddy (voice/text + photo AI assistant — screen #52 and the receipt/
 * pantry review-and-confirm flows) is the flagship reason to upgrade. Every
 * tier gets it, metered: Free gets a small one-time taste, Guided and Budget
 * Buddy get a monthly allowance. No tier is ever literally unlimited.
 */
export function canUseBudgetBuddy(params: CanUseBudgetBuddyParams): FeatureGateResult {
  return evaluateFeatureGate('budgetBuddyAction', {
    plan: params.plan,
    currentUsage: params.actionsUsed,
  });
}
