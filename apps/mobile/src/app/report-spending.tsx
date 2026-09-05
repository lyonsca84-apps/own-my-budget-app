import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listBillPaymentsForReports, listCategories } from '@own-my-budget/api';
import {
  calculateCategoryTotals,
  formatCents,
  formatLocalDate,
  type CategoryTotal,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

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
  const theme = useTheme();
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
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Spending by category
          </ThemedText>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
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
              <ThemedText themeColor="textSecondary">Total: {formatCents(grandTotal)}</ThemedText>
              {totals.map((category) => (
                <Card key={category.categoryId ?? 'uncategorized'} style={{ gap: Spacing.one }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ fontWeight: '700' }}>{category.categoryName}</ThemedText>
                    <ThemedText>{formatCents(category.totalCents)}</ThemedText>
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#00000014',
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${(category.totalCents / maxTotal) * 100}%`,
                        backgroundColor: theme.primary,
                      }}
                    />
                  </View>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
