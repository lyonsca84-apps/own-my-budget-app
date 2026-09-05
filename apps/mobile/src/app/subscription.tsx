import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentAccount, createPortalSession, type CurrentAccount } from '@own-my-budget/api';
import { TIER_LABELS, type PlanTier } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { redirectTo } from '@/lib/redirect';
import { Spacing } from '@/constants/theme';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Free trial',
  past_due: 'Payment issue',
  canceled: 'Canceled',
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  canceled: 'neutral',
};

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const [account, setAccount] = useState<CurrentAccount | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setAccount(await getCurrentAccount(supabase, user.id));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handleManageSubscription() {
    setErrorMessage(null);
    if (Platform.OS !== 'web') {
      setErrorMessage(
        'Manage your subscription from the web app for now — see Settings for a link.'
      );
      return;
    }
    setIsOpeningPortal(true);
    try {
      const url = await createPortalSession(supabase, `${window.location.origin}/subscription`);
      redirectTo(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
      setIsOpeningPortal(false);
    }
  }

  if (!account) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: Spacing.five }}>
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { entitlement } = account;
  const planTier = entitlement.plan_tier as PlanTier;
  const isPaid = planTier !== 'free';

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: Spacing.five, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Subscription &amp; plan
          </ThemedText>

          <Card style={{ gap: Spacing.two }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <ThemedText type="subtitle" style={{ fontSize: 18 }}>
                {TIER_LABELS[planTier]}
              </ThemedText>
              <StatusPill
                label={STATUS_LABEL[entitlement.status] ?? entitlement.status}
                tone={STATUS_TONE[entitlement.status] ?? 'neutral'}
              />
            </View>
            {entitlement.status === 'trialing' && entitlement.trial_ends_at ? (
              <ThemedText themeColor="textSecondary">
                Trial ends {new Date(entitlement.trial_ends_at).toLocaleDateString()}
              </ThemedText>
            ) : null}
            {isPaid && entitlement.current_period_end ? (
              <ThemedText themeColor="textSecondary">
                Renews {new Date(entitlement.current_period_end).toLocaleDateString()}
              </ThemedText>
            ) : null}
          </Card>

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          {isPaid ? (
            <Button
              label={isOpeningPortal ? 'Opening…' : 'Manage subscription'}
              onPress={handleManageSubscription}
              disabled={isOpeningPortal}
            />
          ) : (
            <Button label="Upgrade" onPress={() => router.push('/paywall')} />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
