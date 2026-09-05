import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listDebtsWithPayments,
  listSavingsGoals,
  type DebtWithPayments,
  type Tables,
} from '@own-my-budget/api';
import {
  calculateCreditUtilization,
  calculateSavingsProgress,
  formatCents,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

export default function ReportDebtSavingsScreen() {
  const { status, user } = useAuth();
  const theme = useTheme();
  const [debts, setDebts] = useState<DebtWithPayments[]>([]);
  const [goals, setGoals] = useState<Tables<'savings_goals'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    const [d, g] = await Promise.all([
      listDebtsWithPayments(supabase, user.id),
      listSavingsGoals(supabase, user.id),
    ]);
    setDebts(d);
    setGoals(g);
    setIsLoading(false);
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const totalDebtPaid = debts.reduce(
    (sum, d) => sum + d.debt_payments.reduce((s, p) => s + p.amount_cents, 0),
    0
  );
  const totalSaved = goals.reduce((sum, g) => sum + g.saved_cents, 0);

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Debt &amp; savings progress
          </ThemedText>

          {isLoading ? (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          ) : (
            <>
              <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Paid toward debt
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ fontSize: 20 }}>
                    {formatCents(totalDebtPaid)}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Total saved
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ fontSize: 20 }}>
                    {formatCents(totalSaved)}
                  </ThemedText>
                </View>
              </Card>

              <ThemedText type="smallBold">Debts</ThemedText>
              {debts.length === 0 ? (
                <EmptyState
                  title="No debts on file"
                  message="Add a debt from the Money tab to track it here."
                />
              ) : (
                debts.map((debt) => {
                  const utilization = debt.credit_limit_cents
                    ? calculateCreditUtilization(debt.balance_cents, debt.credit_limit_cents)
                    : null;
                  return (
                    <Card key={debt.id} style={{ gap: Spacing.one }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText style={{ fontWeight: '700' }}>{debt.label}</ThemedText>
                        <ThemedText>{formatCents(debt.balance_cents)}</ThemedText>
                      </View>
                      {utilization !== null && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {utilization.toFixed(0)}% of credit limit used
                        </ThemedText>
                      )}
                    </Card>
                  );
                })
              )}

              <ThemedText type="smallBold">Savings goals</ThemedText>
              {goals.length === 0 ? (
                <EmptyState
                  title="No savings goals yet"
                  message="Add one from the Money tab to track progress here."
                />
              ) : (
                goals.map((goal) => {
                  const progress = calculateSavingsProgress(goal.saved_cents, goal.target_cents);
                  return (
                    <Card key={goal.id} style={{ gap: Spacing.one }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText style={{ fontWeight: '700' }}>{goal.label}</ThemedText>
                        <ThemedText>{progress.percent.toFixed(0)}%</ThemedText>
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
                            width: `${progress.percent}%`,
                            backgroundColor: progress.isComplete ? theme.success : theme.primary,
                          }}
                        />
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
