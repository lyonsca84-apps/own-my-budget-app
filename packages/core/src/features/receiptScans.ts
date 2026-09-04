import { evaluateFeatureGate, type FeatureGateResult } from '../featureGate';
import type { PlanTier } from '../resources';

export interface CanScanReceiptParams {
  plan: PlanTier;
  /** Total receipt scans this account has completed, all time. */
  scansUsed: number;
}

export function canScanReceipt(params: CanScanReceiptParams): FeatureGateResult {
  return evaluateFeatureGate('receiptScan', {
    plan: params.plan,
    currentUsage: params.scansUsed,
  });
}
