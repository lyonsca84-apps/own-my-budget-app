import { useState } from 'react';
import { Platform, View } from 'react-native';
import { createCheckoutSession } from '@own-my-budget/api';
import {
  FEATURE_REGISTRY,
  PLAN_PRICING,
  TIER_LABELS,
  type FeatureKey,
  type PaidPlanTier,
  type PlanTier,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { redirectTo } from '@/lib/redirect';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Interval = 'monthly' | 'yearly';

function countLimit(feature: FeatureKey, tier: PlanTier): number {
  const limit = FEATURE_REGISTRY[feature].limits[tier];
  return limit.kind === 'count' ? limit.limit : 0;
}

function isFlagEnabled(feature: FeatureKey, tier: PlanTier): boolean {
  const limit = FEATURE_REGISTRY[feature].limits[tier];
  return limit.kind === 'flag' && limit.enabled;
}

/** Parses a display price like "$5.99" back to a number, for the yearly-savings math only — never used to duplicate the price itself. */
function parseDollars(display: string): number {
  return parseFloat(display.replace('$', ''));
}

function yearlySavingsLabel(plan: PaidPlanTier): string {
  const pricing = PLAN_PRICING[plan];
  const savings = parseDollars(pricing.monthly) * 12 - parseDollars(pricing.yearly);
  return `Save $${savings.toFixed(2)} a year`;
}

function freeFeatures(): string[] {
  return [
    'Full dashboard, budgeting, bills, and calendar',
    'Basic debt tracking',
    `Up to ${countLimit('savingsGoal', 'free')} savings goals`,
    `${countLimit('receiptScan', 'free')} receipt scans, ever`,
    `${countLimit('pantryScan', 'free')} pantry scan, ever`,
    `${countLimit('budgetBuddyAction', 'free')} Budget Buddy actions to try`,
    `${countLimit('mission', 'free')} Budget Missions to try`,
    'Basic reports',
  ];
}

function guidedFeatures(): string[] {
  return [
    'Unlimited savings goals',
    `${countLimit('receiptScan', 'guided')} receipt scans a month`,
    `${countLimit('pantryScan', 'guided')} pantry scans a month`,
    `${countLimit('budgetBuddyAction', 'guided')} Budget Buddy actions a month`,
    `${countLimit('mission', 'guided')} Budget Missions a month`,
    isFlagEnabled('fullReports', 'guided') ? 'Full reports' : 'Basic reports',
    'Basic debt planning',
  ];
}

function budgetBuddyFeatures(): string[] {
  return [
    'Unlimited savings goals',
    `${countLimit('receiptScan', 'budgetBuddy')} receipt scans a month`,
    `${countLimit('pantryScan', 'budgetBuddy')} pantry scans a month`,
    // Never "unlimited" — every Budget Buddy action is metered, even on the top tier.
    `${countLimit('budgetBuddyAction', 'budgetBuddy')} Budget Buddy actions a month`,
    'Full Missions library',
    isFlagEnabled('fullReports', 'budgetBuddy') ? 'Full reports and export' : 'Full reports',
    isFlagEnabled('advancedDebtScenarios', 'budgetBuddy')
      ? 'Advanced side-by-side debt payoff scenarios'
      : 'Basic debt planning',
  ];
}

export default function PaywallScreen() {
  const { user, status } = useAuth();
  const theme = useTheme();
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
      <Screen>
        <ThemedText themeColor="textSecondary">Create an account to upgrade your plan.</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Choose the support that fits you"
        subtitle="Every plan runs your full budget. Upgrade when you want more guidance — not because the free plan stopped working."
      />

      <SegmentedControl
        value={interval}
        onChange={setInterval}
        options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' },
        ]}
      />

      {errorMessage ? <ThemedText themeColor="danger">{errorMessage}</ThemedText> : null}

      {/* Free */}
      <SectionCard title={TIER_LABELS.free}>
        <ThemedText themeColor="textSecondary">
          Everything you need to run your budget on your own.
        </ThemedText>
        <FeatureList items={freeFeatures()} />
      </SectionCard>

      {/* Guided */}
      <SectionCard title={TIER_LABELS.guided}>
        <PriceRow plan="guided" interval={interval} />
        <ThemedText themeColor="textSecondary">
          More room to grow — unlimited goals, full reports, and steady guidance.
        </ThemedText>
        <FeatureList items={guidedFeatures()} />
        <Button
          label={loadingPlan === 'guided' ? 'Redirecting…' : 'Subscribe to Guided'}
          onPress={() => handleSubscribe('guided')}
          disabled={loadingPlan !== null}
        />
      </SectionCard>

      {/* Budget Buddy is the flagship upgrade and gets the single Panel-navy
          "strongest control" CTA on this screen — recommended, not required. */}
      <SectionCard
        title={TIER_LABELS.budgetBuddy}
        action={
          <View
            style={{
              backgroundColor: theme.primaryMuted,
              borderRadius: Radius.full,
              paddingVertical: 6,
              paddingHorizontal: Space[3],
            }}
          >
            <ThemedText type="smallBold" themeColor="primary">
              Recommended
            </ThemedText>
          </View>
        }
        style={{ borderWidth: 2, borderColor: theme.primary }}
      >
        <PriceRow plan="budgetBuddy" interval={interval} />
        <ThemedText themeColor="textSecondary">
          Your personal budgeting partner — clearer next steps, less manual work, and deeper
          planning when you want it.
        </ThemedText>
        <FeatureList items={budgetBuddyFeatures()} />
        <Button
          label={loadingPlan === 'budgetBuddy' ? 'Redirecting…' : 'Start your 14-day free trial'}
          variant="panel"
          onPress={() => handleSubscribe('budgetBuddy')}
          disabled={loadingPlan !== null}
        />
        <ThemedText type="small" themeColor="textSecondary">
          14 days free, then {PLAN_PRICING.budgetBuddy[interval]}
          {interval === 'monthly' ? '/mo' : '/yr'}. Cancel anytime before the trial ends from
          Settings and you won&rsquo;t be charged.
        </ThemedText>
      </SectionCard>

      <ThemedText type="small" themeColor="textSecondary">
        CSV and JSON export is included on every plan, free or paid.
      </ThemedText>
    </Screen>
  );
}

function PriceRow({ plan, interval }: { plan: PaidPlanTier; interval: Interval }) {
  const pricing = PLAN_PRICING[plan];
  return (
    <View style={{ gap: Space[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Space[1] }}>
        <ThemedText type="amount">{pricing[interval]}</ThemedText>
        <ThemedText themeColor="textSecondary" style={{ marginBottom: 6 }}>
          {interval === 'monthly' ? '/mo' : '/yr'}
        </ThemedText>
      </View>
      {interval === 'yearly' ? (
        <ThemedText type="smallBold" themeColor="success">
          {yearlySavingsLabel(plan)}
        </ThemedText>
      ) : null}
    </View>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <View style={{ gap: Space[2] }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: 'row', gap: Space[2] }}>
          <ThemedText themeColor="success">✓</ThemedText>
          <ThemedText themeColor="textSecondary" style={{ flexShrink: 1 }}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}
