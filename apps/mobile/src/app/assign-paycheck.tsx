import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  getOrCreateBudgetPeriod,
  getPaycheck,
  listCategories,
  markPaycheckAssigned,
  upsertBudgetLine,
  type Tables,
} from '@own-my-budget/api';
import { assignPaycheck, formatCents, formatLocalDate, parseLocalDate } from '@own-my-budget/core';

import { parseDollarsToCents } from '@/components/budget/amount-input';
import { formatPayday } from '@/components/budget/format';
import { ThemedText } from '@/components/themed-text';
import { closeDialogRoute, DialogScreen } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

/**
 * First and last day of the calendar month containing `date`, as YYYY-MM-DD.
 * Uses formatLocalDate rather than toISOString() — the latter converts to
 * UTC first, which silently shifts a locally-constructed date back a day in
 * any US timezone (this app's launch region).
 */
function currentMonthBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatLocalDate(start), end: formatLocalDate(end) };
}

/** Splits a logged paycheck across categories; each amount becomes that category's planned amount for the paycheck's month. */
export default function AssignPaycheckScreen() {
  const { userId, isReady } = useDataUser();
  const { paycheckId } = useLocalSearchParams<{ paycheckId: string }>();
  const [paycheck, setPaycheck] = useState<Tables<'paychecks'> | null>(null);
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !userId || !paycheckId) return;
    let isMounted = true;
    Promise.all([getPaycheck(supabase, paycheckId), listCategories(supabase, userId)])
      .then(([p, c]) => {
        if (!isMounted) return;
        setPaycheck(p);
        setCategories(c);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      });
    return () => {
      isMounted = false;
    };
  }, [isReady, userId, paycheckId]);

  const allocations = categories.map((c) => ({
    categoryId: c.id,
    amountCents: parseDollarsToCents(amounts[c.id] ?? '') ?? 0,
  }));
  const result = assignPaycheck(paycheck?.amount_cents ?? 0, allocations);

  async function handleSave() {
    if (!isReady || !userId || !paycheck) return;
    if (result.isOverAllocated) {
      setErrorMessage("You've allocated more than this paycheck — adjust an amount.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { start, end } = currentMonthBounds(parseLocalDate(paycheck.pay_date));
      const period = await getOrCreateBudgetPeriod(supabase, userId, start, end);
      await Promise.all(
        allocations
          .filter((a) => a.amountCents > 0)
          .map((a) =>
            upsertBudgetLine(supabase, {
              user_id: userId,
              budget_period_id: period.id,
              category_id: a.categoryId,
              planned_cents: a.amountCents,
            })
          )
      );
      await markPaycheckAssigned(supabase, paycheck.id);
      closeDialogRoute();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogScreen
      title="Assign paycheck"
      subtitle={
        paycheck
          ? `${formatCents(paycheck.amount_cents)} received ${formatPayday(paycheck.pay_date)}`
          : undefined
      }
      primaryLabel="Save assignment"
      onPrimary={handleSave}
      primaryDisabled={!paycheck || categories.length === 0 || result.isOverAllocated}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      {!paycheck ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : categories.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          Add a category first (from the Budget tab) before assigning a paycheck.
        </ThemedText>
      ) : (
        <View style={{ gap: Space[4] }}>
          {categories.map((category) => (
            <TextField
              key={category.id}
              label={category.name}
              value={amounts[category.id] ?? ''}
              onChangeText={(text) => setAmounts((prev) => ({ ...prev, [category.id]: text }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          ))}
          <View style={{ gap: Space[1] }}>
            <ThemedText
              type="smallBold"
              themeColor={result.isOverAllocated ? 'warning' : undefined}
            >
              {result.isOverAllocated
                ? `Over by ${formatCents(-result.remainingCents)} — you've allocated more than this paycheck.`
                : `Remaining to assign: ${formatCents(result.remainingCents)}`}
            </ThemedText>
          </View>
        </View>
      )}
    </DialogScreen>
  );
}
