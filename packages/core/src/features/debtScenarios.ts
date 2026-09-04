import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanUseAdvancedDebtScenariosParams {
  plan: PlanTier;
}

/**
 * Every plan gets basic snowball/avalanche payoff planning (screen #34) —
 * this gate only covers the side-by-side advanced comparison view.
 */
export function canUseAdvancedDebtScenarios(
  params: CanUseAdvancedDebtScenariosParams
): FeatureGateResult {
  return evaluateFeatureGate('advancedDebtScenarios', { plan: params.plan });
}
