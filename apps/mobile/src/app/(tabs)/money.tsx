import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyText } from '@/components/ui/currency-text';
import { EmptyState } from '@/components/ui/empty-state';
import { GoalCard } from '@/components/ui/goal-card';
import { Grid } from '@/components/ui/grid';
import { GuestGate } from '@/components/ui/guest-gate';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { SubsectionHeader } from '@/components/ui/subsection-header';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';
import { GoalAssets, type GoalAssetName } from '@/design-system/assets/goals';

const GOAL_ILLUSTRATION: Record<string, GoalAssetName> = {
  'emergency fund': 'emergencyFund',
  'family vacation': 'familyVacation',
  'new laptop': 'newLaptop',
};

function goalIllustrationFor(label: string) {
  const key = Object.keys(GOAL_ILLUSTRATION).find((k) => label.toLowerCase().includes(k));
  return key ? GoalAssets[GOAL_ILLUSTRATION[key]] : undefined;
}

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
      <GuestGate
        title="Plan your payoff and savings"
        message="Guest mode shows sample data only. Create a free account to track your own debts and savings goals."
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Money" />

      {/* ---------- Debt ---------- */}
      <SubsectionHeader
        title="Debt"
        action={
          <Button label="+ Add debt" variant="secondary" onPress={() => router.push('/add-debt')} />
        }
      />

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
          <Card key={debt.id} style={{ gap: Space[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText type="smallBold">{debt.label}</ThemedText>
              <CurrencyText cents={debt.balance_cents} size="row" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {(debt.apr_basis_points / 100).toFixed(2)}% APR ·{' '}
              {formatCents(debt.minimum_payment_cents)}
              /mo min
              {utilization !== null ? ` · ${utilization.toFixed(0)}% utilized` : ''}
              {paidCents > 0 ? ` · ${formatCents(paidCents)} paid so far` : ''}
            </ThemedText>
            {utilization !== null ? (
              <ProgressBar percent={utilization} tone={utilization > 70 ? 'watch' : 'primary'} />
            ) : null}
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label="Record payment"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/record-debt-payment', params: { debtId: debt.id } })
                }
              />
            </View>
          </Card>
        );
      })}

      {debts.length > 0 && (
        <SectionCard title="Payoff plan: snowball vs. avalanche">
          <TextField
            label="Extra you can put toward debt each month"
            value={extraMonthly}
            onChangeText={setExtraMonthly}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <Grid gap={Space[3]}>
            <View style={{ flexGrow: 1, flexBasis: 150 }}>
              <PayoffSummary title="Snowball" result={snowball} />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 150 }}>
              <PayoffSummary title="Avalanche" result={avalanche} />
            </View>
          </Grid>
          <ThemedText type="small" themeColor="textSecondary">
            Snowball pays off the smallest balance first; avalanche pays off the highest interest
            rate first (usually less total interest).
          </ThemedText>
        </SectionCard>
      )}

      {/* ---------- Savings ---------- */}
      <SubsectionHeader
        title="Savings goals"
        action={
          <Button
            label="+ Add goal"
            variant="secondary"
            onPress={() => router.push('/add-savings-goal')}
          />
        }
      />

      {!isLoading && goals.length === 0 && (
        <EmptyState
          title="No savings goals yet"
          message="Set your first goal — an emergency fund is a great start."
          mascot
        />
      )}

      {goals.map((goal) => {
        const progress = calculateSavingsProgress(goal.saved_cents, goal.target_cents);
        return (
          <GoalCard
            key={goal.id}
            title={goal.label}
            savedCents={goal.saved_cents}
            targetCents={goal.target_cents}
            percent={progress.percent}
            isComplete={progress.isComplete}
            targetDate={goal.target_date}
            illustration={goalIllustrationFor(goal.label)}
            actions={
              <>
                <Button
                  label="Add deposit"
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
              </>
            }
          />
        );
      })}
    </Screen>
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
    <Card style={{ gap: Space[1] }}>
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
