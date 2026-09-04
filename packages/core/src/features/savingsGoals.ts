import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanCreateSavingsGoalParams {
  plan: PlanTier;
  /** Number of active (non-deleted) savings goals this account already has. */
  activeGoalCount: number;
}

export function canCreateSavingsGoal(params: CanCreateSavingsGoalParams): FeatureGateResult {
  return evaluateFeatureGate('savingsGoal', {
    plan: params.plan,
    currentUsage: params.activeGoalCount,
  });
}
