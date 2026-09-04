import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getOrCreateBudgetPeriod,
  getPaycheck,
  listCategories,
  markPaycheckAssigned,
  upsertBudgetLine,
  type Tables,
} from '@own-my-budget/api';
import { assignPaycheck, formatCents, formatLocalDate, parseLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

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

export default function AssignPaycheckScreen() {
  const { user } = useAuth();
  const { paycheckId } = useLocalSearchParams<{ paycheckId: string }>();
  const [paycheck, setPaycheck] = useState<Tables<'paychecks'> | null>(null);
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !paycheckId) return;
    Promise.all([getPaycheck(supabase, paycheckId), listCategories(supabase, user.id)]).then(
      ([p, c]) => {
        setPaycheck(p);
        setCategories(c);
      }
    );
  }, [user, paycheckId]);

  if (!paycheck) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.five }}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const allocations = categories.map((c) => ({
    categoryId: c.id,
    amountCents: Math.round((parseFloat(amounts[c.id] ?? '0') || 0) * 100),
  }));
  const result = assignPaycheck(paycheck.amount_cents, allocations);

  async function handleSave() {
    if (!user || !paycheck) return;
    if (result.isOverAllocated) {
      setErrorMessage("You've allocated more than this paycheck — adjust an amount.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { start, end } = currentMonthBounds(parseLocalDate(paycheck.pay_date));
      const period = await getOrCreateBudgetPeriod(supabase, user.id, start, end);
      await Promise.all(
        allocations
          .filter((a) => a.amountCents > 0)
          .map((a) =>
            upsertBudgetLine(supabase, {
              user_id: user.id,
              budget_period_id: period.id,
              category_id: a.categoryId,
              planned_cents: a.amountCents,
            })
          )
      );
      await markPaycheckAssigned(supabase, paycheck.id);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.four }}>
          <View>
            <ThemedText type="title" style={{ fontSize: 22 }}>
              Assign this paycheck
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
              {formatCents(paycheck.amount_cents)} received {paycheck.pay_date}
            </ThemedText>
          </View>

          {categories.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Add a category first (from the Plan tab) before assigning a paycheck.
            </ThemedText>
          ) : (
            <View style={{ gap: Spacing.three }}>
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
            </View>
          )}

          <View style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold">
              Remaining to assign: {formatCents(result.remainingCents)}
            </ThemedText>
            {result.isOverAllocated && (
              <ThemedText type="small" themeColor="danger">
                You&apos;ve allocated more than this paycheck.
              </ThemedText>
            )}
          </View>

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          <Button
            label={isSubmitting ? 'Saving…' : 'Save assignment'}
            onPress={handleSave}
            disabled={isSubmitting || categories.length === 0 || result.isOverAllocated}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
