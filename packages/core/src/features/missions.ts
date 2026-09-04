import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanStartMissionParams {
  plan: PlanTier;
  /** Total Budget Missions started by this account, all time. */
  missionsStarted: number;
}

export function canStartMission(params: CanStartMissionParams): FeatureGateResult {
  return evaluateFeatureGate('mission', {
    plan: params.plan,
    currentUsage: params.missionsStarted,
  });
}
