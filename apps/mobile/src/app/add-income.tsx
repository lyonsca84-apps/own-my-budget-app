import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  createIncomeSource,
  getIncomeSource,
  updateIncomeSource,
  type Database,
} from '@own-my-budget/api';

import { FREQUENCY_LABEL } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

type Frequency = Database['public']['Tables']['income_sources']['Row']['frequency'];
const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'twice_monthly', 'monthly', 'variable'];

/**
 * Adds a pay schedule, or edits one when opened with an `id` param (from the
 * Budget tab's "Pay schedules" list). Schedules are never deleted — editing
 * can pause one (it stops projecting paydays) and resume it later.
 */
export default function AddIncomeScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('biweekly');
  const [nextPayDate, setNextPayDate] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    getIncomeSource(supabase, id)
      .then((source) => {
        if (!isMounted) return;
        setLabel(source.label);
        setAmount((source.amount_cents / 100).toFixed(2));
        setFrequency(source.frequency);
        setNextPayDate(source.next_pay_date ?? '');
        setIsPaused(source.archived_at !== null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleSave() {
    if (!user) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    const trimmedDate = nextPayDate.trim();
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setErrorMessage('Enter the next pay date as YYYY-MM-DD.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (id) {
        await updateIncomeSource(supabase, id, {
          label: label.trim(),
          amount_cents: amountCents,
          frequency,
          next_pay_date: trimmedDate || null,
        });
      } else {
        await createIncomeSource(supabase, {
          user_id: user.id,
          label: label.trim(),
          amount_cents: amountCents,
          frequency,
          next_pay_date: trimmedDate || null,
        });
      }
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTogglePaused() {
    if (!id) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await updateIncomeSource(supabase, id, {
        archived_at: isPaused ? null : new Date().toISOString(),
      });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Screen scroll={false} center>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isEditing ? 'Edit pay schedule' : 'Add income' }} />
      <TextField
        label="Source"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Riverside Retail"
      />
      <TextField
        label="Amount per paycheck"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold">Frequency</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {FREQUENCIES.map((option) => (
            <Button
              key={option}
              label={FREQUENCY_LABEL[option] ?? option}
              variant={option === frequency ? 'primary' : 'secondary'}
              accessibilityState={{ selected: option === frequency }}
              onPress={() => setFrequency(option)}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Next pay date (optional)"
        value={nextPayDate}
        onChangeText={setNextPayDate}
        placeholder="YYYY-MM-DD"
      />

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Save income source'}
        onPress={handleSave}
        disabled={isSubmitting || !label.trim() || !amount.trim()}
      />

      {isEditing ? (
        <View style={{ gap: Spacing.one }}>
          <Button
            variant="secondary"
            label={isPaused ? 'Resume this pay schedule' : 'Pause this pay schedule'}
            onPress={handleTogglePaused}
            disabled={isSubmitting}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {isPaused
              ? 'Paused schedules do not project paydays. Resume it to plan around it again.'
              : 'Pausing stops projecting paydays for this source — nothing is deleted.'}
          </ThemedText>
        </View>
      ) : null}
    </Screen>
  );
}
