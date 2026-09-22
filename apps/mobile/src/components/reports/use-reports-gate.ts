import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { getCurrentAccount } from '@own-my-budget/api';
import { evaluateFeatureGate, type FeatureGateResult, type PlanTier } from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * Whether the account's plan includes full reports (`fullReports` in the
 * feature registry). Guests browse the sample data, so they're never gated.
 * `gate` stays null until the plan has loaded.
 */
export function useReportsGate(): { gate: FeatureGateResult | null; isLoading: boolean } {
  const { status, user } = useAuth();
  const [gate, setGate] = useState<FeatureGateResult | null>(null);
  const [isLoading, setIsLoading] = useState(status === 'signedIn');

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    try {
      const account = await getCurrentAccount(supabase, user.id);
      setGate(
        evaluateFeatureGate('fullReports', { plan: account.entitlement.plan_tier as PlanTier })
      );
    } catch {
      setGate(null);
    } finally {
      setIsLoading(false);
    }
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (status === 'guest') return { gate: { allowed: true, kind: 'flag' }, isLoading: false };
  return { gate, isLoading };
}
