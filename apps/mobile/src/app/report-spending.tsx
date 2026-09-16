import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { listBillPaymentsForReports, listCategories } from '@own-my-budget/api';
import { calculateCategoryTotals, formatLocalDate, type CategoryTotal } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CurrencyText } from '@/components/ui/currency-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

type RangeOption = '1' | '3' | '6' | 'all';
const RANGE_LABELS: Record<RangeOption, string> = {
  '1': 'This month',
  '3': 'Last 3 months',
  '6': 'Last 6 months',
  all: 'All time',
};

function fromDateFor(range: RangeOption): string | undefined {
  if (range === 'all') return undefined;
  const monthsBack = Number(range);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  return formatLocalDate(from);
}

export default function ReportSpendingScreen() {
  const { status, user } = useAuth();
  const [range, setRange] = useState<RangeOption>('3');
  const [totals, setTotals] = useState<CategoryTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    const [payments, categories] = await Promise.all([
      listBillPaymentsForReports(supabase, user.id, { fromDate: fromDateFor(range) }),
      listCategories(supabase, user.id),
    ]);
    setTotals(
      calculateCategoryTotals(
        payments.map((p) => ({ categoryId: p.category_id, amountCents: p.amount_cents })),
        categories
      )
    );
    setIsLoading(false);
  }, [status, user, range]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const maxTotal = Math.max(...totals.map((t) => t.totalCents), 1);
  const grandTotal = totals.reduce((sum, t) => sum + t.totalCents, 0);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
        {(Object.keys(RANGE_LABELS) as RangeOption[]).map((option) => (
          <Button
            key={option}
            label={RANGE_LABELS[option]}
            variant={option === range ? 'primary' : 'secondary'}
            onPress={() => setRange(option)}
          />
        ))}
      </View>

      {isLoading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : totals.length === 0 ? (
        <EmptyState
          title="No bill payments in this range"
          message="Record a bill payment from the Bills tab to see spending broken down here."
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Space[2] }}>
            <ThemedText themeColor="textSecondary">Total</ThemedText>
            <CurrencyText cents={grandTotal} size="row" themeColor="textSecondary" />
          </View>
          {totals.map((category) => (
            <SectionCard
              key={category.categoryId ?? 'uncategorized'}
              title={category.categoryName}
              action={<CurrencyText cents={category.totalCents} size="row" />}
            >
              <ProgressBar percent={(category.totalCents / maxTotal) * 100} />
            </SectionCard>
          ))}
        </>
      )}
    </Screen>
  );
}
