import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanInviteHouseholdMemberParams {
  plan: PlanTier;
}

export function canInviteHouseholdMember(
  params: CanInviteHouseholdMemberParams
): FeatureGateResult {
  return evaluateFeatureGate('householdSharing', { plan: params.plan });
}
