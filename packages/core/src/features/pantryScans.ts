import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanScanPantryParams {
  plan: PlanTier;
  /** Total pantry/fridge scans this account has completed, all time. */
  scansUsed: number;
}

export function canScanPantry(params: CanScanPantryParams): FeatureGateResult {
  return evaluateFeatureGate('pantryScan', {
    plan: params.plan,
    currentUsage: params.scansUsed,
  });
}
