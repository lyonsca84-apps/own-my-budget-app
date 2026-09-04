import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  calculatePayoffSchedule,
  calculateSavingsProgress,
  formatCents,
  type DebtInput,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function MoneyScreen() {
  const { status, user } = useAuth();
  const [debts, setDebts] = useState<DebtWithPayments[]>([]);
  const [goals, setGoals] = useState<Tables<'savings_goals'>[]>([]);
  const [extraMonthly, setExtraMonthly] = useState('0');
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

  const debtInputs: DebtInput[] = useMemo(
    () =>
      debts.map((d) => ({
        id: d.id,
        balanceCents: d.balance_cents,
        aprBasisPoints: d.apr_basis_points,
        minimumPaymentCents: d.minimum_payment_cents,
      })),
    [debts]
  );
  const extraMonthlyCents = Math.round((parseFloat(extraMonthly) || 0) * 100);
  const snowball =
    debtInputs.length > 0
      ? calculatePayoffSchedule(debtInputs, extraMonthlyCents, 'snowball')
      : null;
  const avalanche =
    debtInputs.length > 0
      ? calculatePayoffSchedule(debtInputs, extraMonthlyCents, 'avalanche')
      : null;

  if (status === 'guest') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four }}>
            <EmptyState
              title="Plan your payoff and savings"
              message="Guest mode shows sample data only. Create a free account to track your own debts and savings goals."
            />
            <View style={{ marginTop: Spacing.three }}>
              <Button label="Create an account" onPress={() => router.push('/sign-up')} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
          <View
            style={{
              width: '100%',
              maxWidth: MaxContentWidth,
              alignSelf: 'center',
              gap: Spacing.four,
            }}
          >
            <ThemedText type="title" style={{ fontSize: 24 }}>
              Money
            </ThemedText>

            {/* ---------- Debt ---------- */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <ThemedText type="smallBold">Debt</ThemedText>
              <Button
                label="+ Add debt"
                variant="secondary"
                onPress={() => router.push('/add-debt')}
              />
            </View>

            {!isLoading && debts.length === 0 && (
              <EmptyState
                title="No debts tracked"
                message="Add a credit card, loan, or mortgage to get started."
              />
            )}

            {debts.map((debt) => {
              const paidCents = debt.debt_payments.reduce((sum, p) => sum + p.amount_cents, 0);
              const utilization =
                debt.type === 'creditCard' && debt.credit_limit_cents
                  ? calculateCreditUtilization(debt.balance_cents, debt.credit_limit_cents)
                  : null;
              return (
                <Card key={debt.id} style={{ gap: Spacing.two }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ fontWeight: '700' }}>{debt.label}</ThemedText>
                    <ThemedText style={{ fontWeight: '700' }}>
                      {formatCents(debt.balance_cents)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {(debt.apr_basis_points / 100).toFixed(2)}% APR ·{' '}
                    {formatCents(debt.minimum_payment_cents)}/mo min
                    {utilization !== null ? ` · ${utilization.toFixed(0)}% utilized` : ''}
                    {paidCents > 0 ? ` · ${formatCents(paidCents)} paid so far` : ''}
                  </ThemedText>
                  <View style={{ alignSelf: 'flex-start' }}>
                    <Button
                      label="Record payment"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: '/record-debt-payment',
                          params: { debtId: debt.id },
                        })
                      }
                    />
                  </View>
                </Card>
              );
            })}

            {debts.length > 0 && (
              <Card style={{ gap: Spacing.three }}>
                <ThemedText type="smallBold">Payoff plan: snowball vs. avalanche</ThemedText>
                <TextField
                  label="Extra you can put toward debt each month"
                  value={extraMonthly}
                  onChangeText={setExtraMonthly}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                <View style={{ flexDirection: 'row', gap: Spacing.three }}>
                  <PayoffSummary title="Snowball" result={snowball} />
                  <PayoffSummary title="Avalanche" result={avalanche} />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Snowball pays off the smallest balance first; avalanche pays off the highest
                  interest rate first (usually less total interest).
                </ThemedText>
              </Card>
            )}

            {/* ---------- Savings ---------- */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <ThemedText type="smallBold">Savings goals</ThemedText>
              <Button
                label="+ Add goal"
                variant="secondary"
                onPress={() => router.push('/add-savings-goal')}
              />
            </View>

            {!isLoading && goals.length === 0 && (
              <EmptyState
                title="No savings goals yet"
                message="Set your first goal — an emergency fund is a great start."
              />
            )}

            {goals.map((goal) => {
              const progress = calculateSavingsProgress(goal.saved_cents, goal.target_cents);
              return (
                <Card key={goal.id} style={{ gap: Spacing.two }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ fontWeight: '700' }}>{goal.label}</ThemedText>
                    {progress.isComplete && <StatusPill label="Reached!" tone="success" />}
                  </View>
                  <ThemedText themeColor="textSecondary" type="small">
                    {formatCents(goal.saved_cents)} of {formatCents(goal.target_cents)} (
                    {progress.percent.toFixed(0)}%)
                  </ThemedText>
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
                        backgroundColor: progress.isComplete ? '#2F8F4E' : '#0B6FB8',
                      }}
                    />
                  </View>
                  {!progress.isComplete && goal.target_date && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Target date: {goal.target_date}
                    </ThemedText>
                  )}
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Button
                      label="Add deposit"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: '/add-goal-activity',
                          params: { goalId: goal.id, kind: 'deposit' },
                        })
                      }
                    />
                    <Button
                      label="Withdraw"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: '/add-goal-activity',
                          params: { goalId: goal.id, kind: 'withdrawal' },
                        })
                      }
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PayoffSummary({
  title,
  result,
}: {
  title: string;
  result: { months: number; totalInterestCents: number; payoffDate: string } | null;
}) {
  return (
    <Card style={{ flex: 1, gap: Spacing.half }}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {result ? (
        <>
          <ThemedText type="small">{result.months} months</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatCents(result.totalInterestCents)} interest
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Debt-free {result.payoffDate}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          —
        </ThemedText>
      )}
    </Card>
  );
}
