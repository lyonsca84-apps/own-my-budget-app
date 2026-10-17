import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { getCurrentAccount, getFeatureUsageCount } from '@own-my-budget/api';
import {
  evaluateFeatureGate,
  getUsagePeriodStart,
  FEATURE_REGISTRY,
  type FeatureGateResult,
  type PlanTier,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * Loads the current plan's allowance for a metered AI scan feature and
 * re-checks it every time the screen regains focus (so the count is right
 * after coming back from a completed scan). Guests never have a gate — they
 * have no real entitlement, and the scan screens send them to sign up.
 */
export function useScanGate(feature: 'receiptScan' | 'pantryScan') {
  const { status, user } = useAuth();
  const [gate, setGate] = useState<FeatureGateResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    try {
      const account = await getCurrentAccount(supabase, user.id);
      const plan = account.entitlement.plan_tier as PlanTier;
      const limit = FEATURE_REGISTRY[feature].limits[plan];
      const periodStart = getUsagePeriodStart(
        limit.kind === 'count' ? (limit.period ?? 'lifetime') : 'lifetime'
      );
      const currentUsage = await getFeatureUsageCount(supabase, user.id, feature, periodStart);
      setGate(evaluateFeatureGate(feature, { plan, currentUsage }));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [status, user, feature]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { gate, loadFailed, reload };
}

/** "3 scans left" — only meaningful for metered ('count') gates. */
export function describeRemainingScans(gate: FeatureGateResult | null): string | null {
  if (!gate || gate.kind !== 'count' || gate.remaining === undefined) return null;
  return `${gate.remaining} scan${gate.remaining === 1 ? '' : 's'} left`;
}
