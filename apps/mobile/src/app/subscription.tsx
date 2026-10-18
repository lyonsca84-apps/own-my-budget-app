import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { getCurrentAccount, createPortalSession, type CurrentAccount } from '@own-my-budget/api';
import { TIER_LABELS, type PlanTier } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { redirectTo } from '@/lib/redirect';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Free trial',
  past_due: 'Payment issue',
  canceled: 'Canceled',
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "$9.99 per month" from Stripe's price, or null when Stripe hasn't reported it yet. */
function formatPrice(
  cents: number | null | undefined,
  currency: string | null | undefined,
  interval: string | null | undefined
): string | null {
  if (cents == null || !interval) return null;
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
  }).format(cents / 100);
  return `${amount} per ${interval === 'year' ? 'year' : 'month'}`;
}

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
      <Screen>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  const { entitlement } = account;
  const planTier = entitlement.plan_tier as PlanTier;
  const isPaid = planTier !== 'free';
  // Price, interval and a scheduled cancellation come from Stripe via the
  // stripe-webhook function (never from a client redirect).
  const price = formatPrice(
    entitlement.price_amount_cents,
    entitlement.price_currency,
    entitlement.billing_interval
  );
  const endsOn = entitlement.cancel_at_period_end
    ? (entitlement.cancel_at ?? entitlement.current_period_end)
    : entitlement.cancel_at;

  return (
    <Screen>
      <SectionCard
        title={TIER_LABELS[planTier]}
        action={
          <StatusPill
            label={STATUS_LABEL[entitlement.status] ?? entitlement.status}
            tone={STATUS_TONE[entitlement.status] ?? 'neutral'}
          />
        }
      >
        {isPaid ? (
          <ThemedText>
            {price ?? 'Price and billing period appear here after Stripe’s next update.'}
          </ThemedText>
        ) : (
          <ThemedText themeColor="textSecondary">$0. No payment method needed.</ThemedText>
        )}
        {entitlement.status === 'trialing' && entitlement.trial_ends_at ? (
          <ThemedText themeColor="textSecondary">
            Trial ends {longDate(entitlement.trial_ends_at)}
          </ThemedText>
        ) : null}
        {isPaid && endsOn ? (
          <ThemedText themeColor="warning">
            Cancels on {longDate(endsOn)}. You keep {TIER_LABELS[planTier]} until then, then your
            account moves to the Free plan.
          </ThemedText>
        ) : isPaid && entitlement.current_period_end ? (
          <ThemedText themeColor="textSecondary">
            Renews {longDate(entitlement.current_period_end)}
          </ThemedText>
        ) : null}
        {entitlement.status === 'past_due' ? (
          <ThemedText themeColor="warning">
            Stripe couldn’t take the last payment. Update your payment method in Manage subscription
            to keep your plan.
          </ThemedText>
        ) : null}
      </SectionCard>

      {isPaid ? (
        <SectionCard title="If you cancel">
          <ThemedText themeColor="textSecondary">
            Cancel from Manage subscription, Stripe’s secure billing page. Stripe shows exactly when
            your access ends before you confirm, and nothing is canceled until you confirm there.
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Once Stripe confirms, this page shows your end date. When a paid plan ends, your account
            moves to the Free plan and your budget data stays in your account.
          </ThemedText>
        </SectionCard>
      ) : null}

      {errorMessage ? <ThemedText themeColor="danger">{errorMessage}</ThemedText> : null}

      {isPaid ? (
        <Button
          label={isOpeningPortal ? 'Opening…' : 'Manage or cancel subscription'}
          variant="secondary"
          onPress={handleManageSubscription}
          disabled={isOpeningPortal}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : (
        <Button
          label="Upgrade"
          variant="panel"
          onPress={() => router.push('/paywall')}
          style={{ alignSelf: 'flex-start' }}
        />
      )}
    </Screen>
  );
}
