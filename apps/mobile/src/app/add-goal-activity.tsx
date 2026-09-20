import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { recordGoalActivity } from '@own-my-budget/api';
import { formatCents, formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { notifyGoalMilestoneIfCrossed } from '@/lib/notifications';

export default function AddGoalActivityScreen() {
  const {
    goalId,
    kind,
    amountCents: prefillCents,
    note: prefillNote,
  } = useLocalSearchParams<{
    goalId: string;
    kind: 'deposit' | 'withdrawal';
    /** Optional prefill, e.g. the next 52-week-challenge week's deposit. */
    amountCents?: string;
    note?: string;
  }>();
  const { user } = useAuth();
  const isWithdrawal = kind === 'withdrawal';
  const [amount, setAmount] = useState(() => {
    const cents = Number(prefillCents);
    return Number.isFinite(cents) && cents > 0 ? (cents / 100).toFixed(2) : '';
  });
  const [occurredOn, setOccurredOn] = useState(formatLocalDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!goalId) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const goalBefore = await supabase
        .from('savings_goals')
        .select('label, saved_cents, target_cents')
        .eq('id', goalId)
        .single();

      if (isWithdrawal && goalBefore.data && amountCents > goalBefore.data.saved_cents) {
        setErrorMessage(
          `You only have ${formatCents(goalBefore.data.saved_cents)} saved in this goal.`
        );
        return;
      }

      await recordGoalActivity(supabase, {
        goalId,
        amountCents,
        kind: isWithdrawal ? 'withdrawal' : 'deposit',
        occurredOn,
        note: prefillNote || undefined,
      });

      if (!isWithdrawal && goalBefore.data && user) {
        // The deposit already succeeded above — a failure here (e.g. a
        // notification-permission hiccup) must never surface as an error
        // for an already-successful save.
        try {
          await notifyGoalMilestoneIfCrossed(supabase, user.id, {
            goalLabel: goalBefore.data.label,
            previousSavedCents: goalBefore.data.saved_cents,
            newSavedCents: goalBefore.data.saved_cents + amountCents,
            targetCents: goalBefore.data.target_cents,
          });
        } catch {
          // Ignore — the deposit itself is what matters.
        }
      }

      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      {prefillNote ? (
        <ThemedText type="smallBold" themeColor="primary">
          {prefillNote}
        </ThemedText>
      ) : null}
      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      <TextField
        label="Date"
        value={occurredOn}
        onChangeText={setOccurredOn}
        placeholder="YYYY-MM-DD"
      />

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : isWithdrawal ? 'Save withdrawal' : 'Save deposit'}
        onPress={handleSave}
        disabled={isSubmitting || !amount.trim()}
      />
    </Screen>
  );
}
