import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { listDebtsWithPayments, listSavingsGoals } from '@own-my-budget/api';
import {
  DEMO_DATA,
  calculateCreditUtilization,
  calculateSavingsProgress,
  formatCents,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { useReportsGate } from '@/components/reports/use-reports-gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { LimitNotice } from '@/components/ui/limit-notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

interface DebtRow {
  id: string;
  label: string;
  balanceCents: number;
  paidCents: number | null;
  creditLimitCents: number | null;
}

interface GoalRow {
  id: string;
  label: string;
  savedCents: number;
  targetCents: number;
}

function demoRows(): { debts: DebtRow[]; goals: GoalRow[] } {
  return {
    debts: DEMO_DATA.debts.map((d) => ({
      id: d.id,
      label: d.label,
      balanceCents: d.balanceCents,
      paidCents: null,
      creditLimitCents: d.creditLimitCents ?? null,
    })),
    goals: DEMO_DATA.savingsGoals.map((g) => ({
      id: g.id,
      label: g.label,
      savedCents: g.savedCents,
      targetCents: g.targetCents,
    })),
  };
}

export default function ReportDebtSavingsScreen() {
  const { status, user } = useAuth();
  const { gate, isLoading: isGateLoading } = useReportsGate();
  const isGuest = status === 'guest';
  const canView = gate?.allowed === true;
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [isLoading, setIsLoading] = useState(status === 'signedIn');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user || !canView) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [d, g] = await Promise.all([
        listDebtsWithPayments(supabase, user.id),
        listSavingsGoals(supabase, user.id),
      ]);
      setDebts(
        d.map((debt) => ({
          id: debt.id,
          label: debt.label,
          balanceCents: debt.balance_cents,
          paidCents: debt.debt_payments.reduce((sum, p) => sum + p.amount_cents, 0),
          creditLimitCents: debt.credit_limit_cents,
        }))
      );
      setGoals(
        g.map((goal) => ({
          id: goal.id,
          label: goal.label,
          savedCents: goal.saved_cents,
          targetCents: goal.target_cents,
        }))
      );
    } catch {
      setErrorMessage("We couldn't load your debts and goals just now.");
    } finally {
      setIsLoading(false);
    }
  }, [status, user, canView]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const rows = isGuest ? demoRows() : { debts, goals };
  const totalDebtCents = rows.debts.reduce((sum, d) => sum + d.balanceCents, 0);
  const totalPaidCents = rows.debts.reduce((sum, d) => sum + (d.paidCents ?? 0), 0);
  const totalSavedCents = rows.goals.reduce((sum, g) => sum + g.savedCents, 0);

  return (
    <Screen showGuestBanner>
      <Stack.Screen options={{ title: 'Debt & savings progress' }} />
      <ScreenHeader
        title="Debt & savings progress"
        subtitle="What you owe, what you've paid, and how your goals are filling up."
      />

      {isGateLoading || (!isGuest && isLoading) ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </Card>
      ) : !canView ? (
        <LimitNotice
          title="Full reports are on a higher plan"
          reason={gate?.reason ?? "We couldn't check your plan just now. Please try again."}
        />
      ) : errorMessage ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText themeColor="warning">{errorMessage}</ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Button label="Try again" variant="secondary" onPress={reload} />
          </View>
        </Card>
      ) : (
        <>
          <Grid>
            <StatTile
              label="Debt remaining"
              valueCents={totalDebtCents}
              glyph="↘"
              glyphColor="primary"
              glyphTint="primaryMuted"
              description="Total balance across your debts."
            />
            {!isGuest ? (
              <StatTile
                label="Paid toward debt"
                valueCents={totalPaidCents}
                glyph="✓"
                glyphColor="success"
                glyphTint="successMuted"
                description="Payments you've recorded."
              />
            ) : null}
            <StatTile
              label="Total saved"
              valueCents={totalSavedCents}
              glyph="◆"
              glyphColor="success"
              glyphTint="successMuted"
              description="Across all your savings goals."
            />
          </Grid>

          {rows.debts.length === 0 ? (
            <EmptyState
              mascot
              title="No debts on file"
              message="Nothing to track here — or add a debt from the Bills tab to follow its progress."
            />
          ) : (
            <SectionCard title="Debts">
              <View style={{ gap: Space[4] }}>
                {rows.debts.map((debt) => {
                  const utilization = debt.creditLimitCents
                    ? calculateCreditUtilization(debt.balanceCents, debt.creditLimitCents)
                    : null;
                  return (
                    <View key={debt.id} style={{ gap: Space[2] }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: Space[3],
                        }}
                      >
                        <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
                          {debt.label}
                        </ThemedText>
                        <ThemedText type="amountSmall">{formatCents(debt.balanceCents)}</ThemedText>
                      </View>
                      {utilization !== null ? (
                        <>
                          <ProgressBar
                            percent={utilization}
                            tone={utilization > 50 ? 'watch' : 'primary'}
                          />
                          <ThemedText type="small" themeColor="textSecondary">
                            {utilization.toFixed(0)}% of credit limit used
                          </ThemedText>
                        </>
                      ) : null}
                      {debt.paidCents ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatCents(debt.paidCents)} paid so far
                        </ThemedText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </SectionCard>
          )}

          {rows.goals.length === 0 ? (
            <EmptyState
              mascot
              title="No savings goals yet"
              message="Add one from the Goals tab and watch it fill up here."
            />
          ) : (
            <SectionCard title="Savings goals">
              <View style={{ gap: Space[4] }}>
                {rows.goals.map((goal) => {
                  const progress = calculateSavingsProgress(goal.savedCents, goal.targetCents);
                  return (
                    <View key={goal.id} style={{ gap: Space[2] }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          gap: Space[3],
                        }}
                      >
                        <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
                          {goal.label}
                        </ThemedText>
                        <ThemedText type="smallBold">{progress.percent.toFixed(0)}%</ThemedText>
                      </View>
                      <ProgressBar
                        percent={progress.percent}
                        tone={progress.isComplete ? 'success' : 'primary'}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatCents(goal.savedCents)} of {formatCents(goal.targetCents)}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </SectionCard>
          )}
        </>
      )}
    </Screen>
  );
}
