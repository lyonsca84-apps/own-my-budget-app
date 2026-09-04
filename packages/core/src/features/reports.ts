import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanViewFullReportsParams {
  plan: PlanTier;
}

export function canViewFullReports(params: CanViewFullReportsParams): FeatureGateResult {
  return evaluateFeatureGate('fullReports', { plan: params.plan });
}
