import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createCheckoutSession } from '@own-my-budget/api';
import {
  FEATURE_REGISTRY,
  PLAN_PRICING,
  TIER_LABELS,
  type PaidPlanTier,
  type PlanTier,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { redirectTo } from '@/lib/redirect';
import { Spacing } from '@/constants/theme';

type Interval = 'monthly' | 'yearly';

function limitSummary(plan: PlanTier, featureKey: keyof typeof FEATURE_REGISTRY): string {
  const limit = FEATURE_REGISTRY[featureKey].limits[plan];
  switch (limit.kind) {
    case 'unlimited':
      return 'Unlimited';
    case 'flag':
      return limit.enabled ? 'Included' : 'Not included';
    case 'count':
      return `${limit.limit}${limit.period === 'monthly' ? '/month' : limit.period === 'lifetime' ? ' total' : ''}`;
  }
}

const COMPARISON_ROWS: (keyof typeof FEATURE_REGISTRY)[] = [
  'receiptScan',
  'pantryScan',
  'budgetBuddyAction',
  'mission',
  'fullReports',
  'advancedDebtScenarios',
];

export default function PaywallScreen() {
  const { user, status } = useAuth();
  const [interval, setInterval] = useState<Interval>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanTier | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubscribe(plan: PaidPlanTier) {
    if (!user) return;
    setErrorMessage(null);

    if (Platform.OS !== 'web') {
      setErrorMessage(
        'Subscribing is available on the web app for now — open Own My Budget in a browser to upgrade.'
      );
      return;
    }

    setLoadingPlan(plan);
    try {
      const url = await createCheckoutSession(supabase, {
        plan,
        interval,
        successUrl: `${window.location.origin}/subscription`,
        cancelUrl: `${window.location.origin}/paywall`,
      });
      redirectTo(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
      setLoadingPlan(null);
    }
  }

  if (status !== 'signedIn') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: Spacing.five }}>
            <ThemedText themeColor="textSecondary">
              Create an account to upgrade your plan.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Choose your plan
          </ThemedText>

          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button
              label="Monthly"
              variant={interval === 'monthly' ? 'primary' : 'secondary'}
              onPress={() => setInterval('monthly')}
            />
            <Button
              label="Yearly"
              variant={interval === 'yearly' ? 'primary' : 'secondary'}
              onPress={() => setInterval('yearly')}
            />
          </View>

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          {(['guided', 'budgetBuddy'] as PaidPlanTier[]).map((plan) => {
            const pricing = PLAN_PRICING[plan];
            return (
              <Card key={plan} style={{ gap: Spacing.two }}>
                <ThemedText type="subtitle" style={{ fontSize: 18 }}>
                  {TIER_LABELS[plan]}
                </ThemedText>
                <ThemedText type="title" style={{ fontSize: 28 }}>
                  {pricing[interval]}
                  <ThemedText themeColor="textSecondary" style={{ fontSize: 16 }}>
                    {interval === 'monthly' ? '/mo' : '/yr'}
                  </ThemedText>
                </ThemedText>
                {pricing.trialDays ? (
                  <ThemedText type="small" themeColor="success">
                    {pricing.trialDays}-day free trial
                  </ThemedText>
                ) : null}

                {COMPARISON_ROWS.map((key) => (
                  <ThemedText key={key} type="small" themeColor="textSecondary">
                    {FEATURE_REGISTRY[key].label}: {limitSummary(plan, key)}
                  </ThemedText>
                ))}

                <Button
                  label={
                    loadingPlan === plan ? 'Redirecting…' : `Subscribe to ${TIER_LABELS[plan]}`
                  }
                  onPress={() => handleSubscribe(plan)}
                  disabled={loadingPlan !== null}
                />
              </Card>
            );
          })}

          <ThemedText type="small" themeColor="textSecondary">
            Free plan:{' '}
            {COMPARISON_ROWS.map(
              (key) => `${FEATURE_REGISTRY[key].label} — ${limitSummary('free', key)}`
            ).join(' · ')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
