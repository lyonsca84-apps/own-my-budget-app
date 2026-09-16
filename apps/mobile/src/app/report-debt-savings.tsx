import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import {
  listDebtsWithPayments,
  listSavingsGoals,
  type DebtWithPayments,
  type Tables,
} from '@own-my-budget/api';
import { calculateCreditUtilization, calculateSavingsProgress } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { CurrencyText } from '@/components/ui/currency-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

export default function ReportDebtSavingsScreen() {
  const { status, user } = useAuth();
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
    <Screen>
      {isLoading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : (
        <>
          <Grid>
            <StatTile
              label="Paid toward debt"
              valueCents={totalDebtPaid}
              glyph="↘"
              glyphColor="accent"
              glyphTint="accentMuted"
            />
            <StatTile
              label="Total saved"
              valueCents={totalSaved}
              glyph="◆"
              glyphColor="success"
              glyphTint="successMuted"
            />
          </Grid>

          {debts.length === 0 ? (
            <EmptyState
              title="No debts on file"
              message="Add a debt from the Money tab to track it here."
            />
          ) : (
            <SectionCard title="Debts">
              <View style={{ gap: Space[4] }}>
                {debts.map((debt) => {
                  const utilization = debt.credit_limit_cents
                    ? calculateCreditUtilization(debt.balance_cents, debt.credit_limit_cents)
                    : null;
                  return (
                    <View key={debt.id} style={{ gap: Space[1] }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <ThemedText>{debt.label}</ThemedText>
                        <CurrencyText cents={debt.balance_cents} size="row" />
                      </View>
                      {utilization !== null && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {utilization.toFixed(0)}% of credit limit used
                        </ThemedText>
                      )}
                    </View>
                  );
                })}
              </View>
            </SectionCard>
          )}

          {goals.length === 0 ? (
            <EmptyState
              title="No savings goals yet"
              message="Add one from the Money tab to track progress here."
            />
          ) : (
            <SectionCard title="Savings goals">
              <View style={{ gap: Space[4] }}>
                {goals.map((goal) => {
                  const progress = calculateSavingsProgress(goal.saved_cents, goal.target_cents);
                  return (
                    <View key={goal.id} style={{ gap: Space[2] }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText>{goal.label}</ThemedText>
                        <ThemedText>{progress.percent.toFixed(0)}%</ThemedText>
                      </View>
                      <ProgressBar
                        percent={progress.percent}
                        tone={progress.isComplete ? 'success' : 'primary'}
                      />
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
