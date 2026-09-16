import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import {
  listPaychecks,
  listBillPaymentsForReports,
  listDebtPaymentsForReports,
} from '@own-my-budget/api';
import { calculateMonthlyTrend, formatCents, type MonthlyTotal } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { CurrencyText } from '@/components/ui/currency-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

const MONTHS_BACK = 6;

export default function ReportIncomeExpensesScreen() {
  const { status, user } = useAuth();
  const theme = useTheme();
  const [income, setIncome] = useState<MonthlyTotal[]>([]);
  const [expenses, setExpenses] = useState<MonthlyTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    const [paychecks, billPayments, debtPayments] = await Promise.all([
      listPaychecks(supabase, user.id),
      listBillPaymentsForReports(supabase, user.id),
      listDebtPaymentsForReports(supabase, user.id),
    ]);
    setIncome(
      calculateMonthlyTrend(
        paychecks.map((p) => ({ occurredOn: p.pay_date, amountCents: p.amount_cents })),
        MONTHS_BACK
      )
    );
    setExpenses(
      calculateMonthlyTrend(
        [
          ...billPayments.map((p) => ({ occurredOn: p.paid_on, amountCents: p.amount_cents })),
          ...debtPayments.map((p) => ({ occurredOn: p.paid_on, amountCents: p.amount_cents })),
        ],
        MONTHS_BACK
      )
    );
    setIsLoading(false);
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const maxCents = Math.max(
    ...income.map((m) => m.totalCents),
    ...expenses.map((m) => m.totalCents),
    1
  );
  const hasAnyData = income.some((m) => m.totalCents > 0) || expenses.some((m) => m.totalCents > 0);

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">Last {MONTHS_BACK} months</ThemedText>

      <View style={{ flexDirection: 'row', gap: Space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[1] }}>
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.success }}
          />
          <ThemedText type="small">Income</ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[1] }}>
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.warning }}
          />
          <ThemedText type="small">Expenses</ThemedText>
        </View>
      </View>

      {isLoading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : !hasAnyData ? (
        <EmptyState
          title="Nothing recorded yet"
          message="Log a paycheck and record a bill or debt payment to see the trend build up here."
        />
      ) : (
        income.map((month, index) => {
          const expenseMonth = expenses[index];
          const net = month.totalCents - (expenseMonth?.totalCents ?? 0);
          return (
            <SectionCard
              key={month.month}
              title={month.month}
              action={
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  {net >= 0 ? (
                    <ThemedText type="smallBold" themeColor="success">
                      +
                    </ThemedText>
                  ) : null}
                  <CurrencyText
                    cents={net}
                    size="row"
                    themeColor={net >= 0 ? 'success' : 'danger'}
                  />
                </View>
              }
            >
              <View style={{ gap: Space[2] }}>
                <ProgressBar percent={(month.totalCents / maxCents) * 100} tone="success" />
                <ProgressBar
                  percent={((expenseMonth?.totalCents ?? 0) / maxCents) * 100}
                  tone="watch"
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatCents(month.totalCents)} in · {formatCents(expenseMonth?.totalCents ?? 0)}{' '}
                  out
                </ThemedText>
              </View>
            </SectionCard>
          );
        })
      )}
    </Screen>
  );
}
