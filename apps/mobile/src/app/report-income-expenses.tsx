import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listPaychecks,
  listBillPaymentsForReports,
  listDebtPaymentsForReports,
} from '@own-my-budget/api';
import { calculateMonthlyTrend, formatCents, type MonthlyTotal } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

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
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Income vs. expenses
          </ThemedText>
          <ThemedText themeColor="textSecondary">Last {MONTHS_BACK} months</ThemedText>

          <View style={{ flexDirection: 'row', gap: Spacing.three }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.success }}
              />
              <ThemedText type="small">Income</ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
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
                <Card key={month.month} style={{ gap: Spacing.one }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ fontWeight: '700' }}>{month.month}</ThemedText>
                    <ThemedText themeColor={net >= 0 ? 'success' : 'danger'}>
                      Net {net >= 0 ? '+' : ''}
                      {formatCents(net)}
                    </ThemedText>
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
                        width: `${(month.totalCents / maxCents) * 100}%`,
                        backgroundColor: theme.success,
                      }}
                    />
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
                        width: `${((expenseMonth?.totalCents ?? 0) / maxCents) * 100}%`,
                        backgroundColor: theme.warning,
                      }}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCents(month.totalCents)} in ·{' '}
                    {formatCents(expenseMonth?.totalCents ?? 0)} out
                  </ThemedText>
                </Card>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
