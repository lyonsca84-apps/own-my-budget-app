import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { CashFlowCard } from '@/components/dashboard/cash-flow-card';
import { COLUMN_STYLE } from '@/components/dashboard/common';
import { CategorySpendingCard } from '@/components/dashboard/category-spending-card';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DebtProgressCard, QuickActionsCard } from '@/components/dashboard/debt-and-actions';
import { MONTH_NAMES } from '@/components/dashboard/format';
import { GoalsCard } from '@/components/dashboard/goals-card';
import { HealthCard } from '@/components/dashboard/health-card';
import { InsightsCard, MissionsCard, TipCard } from '@/components/dashboard/insight-cards';
import { NextPaycheckCard } from '@/components/dashboard/next-paycheck-card';
import { SnapshotGrid } from '@/components/dashboard/snapshot-grid';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { UpcomingBillsCard } from '@/components/dashboard/upcoming-bills-card';
import { useDashboardData } from '@/components/dashboard/use-dashboard-data';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/contexts/auth-context';
import { Radius, Space } from '@/constants/theme';
import { rescheduleAllNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

export default function DashboardScreen() {
  const theme = useTheme();
  const { status, user } = useAuth();
  const data = useDashboardData();
  const { model } = data;
  const periodLabel = `${MONTH_NAMES[data.month]} ${data.year}`;

  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    // Keeps scheduled bill/payday reminders in sync with current data.
    // Best-effort: a failure here must never break the Dashboard itself.
    rescheduleAllNotifications(supabase, user.id).catch(() => {});
  }, [status, user]);

  return (
    <Screen showGuestBanner>
      <DashboardHeader
        displayName={model.displayName}
        month={data.month}
        year={data.year}
        onMonthChange={data.setMonth}
        onYearChange={data.setYear}
        onRefresh={data.refresh}
      />

      {data.errorMessage ? (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Space[3],
            backgroundColor: theme.warningMuted,
            borderRadius: Radius.input,
            paddingVertical: Space[3],
            paddingHorizontal: Space[4],
          }}
        >
          <ThemedText type="smallBold" themeColor="warning" style={{ flexShrink: 1 }}>
            {data.errorMessage}
          </ThemedText>
          <Button label="Dismiss" variant="quiet" onPress={data.clearError} />
        </View>
      ) : null}

      {data.isLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading your budget…</ThemedText>
        </Card>
      ) : (
        <>
          {model.isEmpty ? (
            <Card style={{ alignItems: 'center', gap: Space[2], padding: Space[7] }}>
              <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                Let&rsquo;s build your budget picture
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ textAlign: 'center', maxWidth: 420 }}
              >
                Add your income and monthly bills to see your complete budget picture.
              </ThemedText>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: Space[2],
                  marginTop: Space[2],
                }}
              >
                <Button
                  label="Add income"
                  shape="rounded"
                  onPress={() => router.push('/add-income')}
                />
                <Button
                  label="Add a bill"
                  variant="outline"
                  shape="rounded"
                  onPress={() => router.push('/add-bill')}
                />
              </View>
            </Card>
          ) : null}

          <SummaryCards
            cards={[
              {
                label: 'Total Income',
                cents: model.income.cents,
                glyph: '↗',
                glyphColor: 'solidAccent',
                glyphTint: 'accentMuted',
                note: model.income.change,
                help: 'Take-home pay expected from your pay schedules this month.',
              },
              {
                label: 'Bills and Payments',
                cents: model.billsAndPayments.cents,
                glyph: '≡',
                glyphColor: 'text',
                glyphTint: 'backgroundSelected',
                note: {
                  text: `${model.billsAndPayments.paidCount} of ${model.billsAndPayments.totalCount} bills paid`,
                  tone: 'neutral',
                },
                help: 'Everything due this month across bills, cards and loans.',
              },
              {
                label: 'Savings',
                cents: model.savings.cents,
                glyph: '◆',
                glyphColor: 'success',
                glyphTint: 'successMuted',
                note: model.savings.change,
                help: 'Money you moved into savings goals this month.',
              },
              {
                label: 'Money Available',
                cents: model.available.cents,
                glyph: '●',
                glyphColor: 'primary',
                glyphTint: 'primaryMuted',
                note: model.available.change,
                help: 'What is left after bills, debt, spending and savings.',
              },
            ]}
          />

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              gap: Space[5],
            }}
          >
            <View style={COLUMN_STYLE}>
              <CashFlowCard
                periodLabel={periodLabel}
                cashFlow={model.cashFlow}
                chartBars={model.chartBars}
              />
              <UpcomingBillsCard bills={model.upcomingBills} />
              <CategorySpendingCard
                rows={model.categoryRows}
                periodLabel={periodLabel}
                onSavePlanned={data.savePlanned}
                onSaveActual={data.saveActual}
              />
            </View>
            <View style={COLUMN_STYLE}>
              <HealthCard
                health={model.health}
                change={model.healthChange}
                improveTips={model.improveTips}
              />
              <SnapshotGrid cards={model.snapshots} />
              <TipCard tips={model.tips} />
              <MissionsCard missions={model.missions} />
              <InsightsCard insights={model.insights} />
            </View>
          </View>

          <GoalsCard goals={model.goals} />

          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: Space[5] }}
          >
            <View style={{ ...COLUMN_STYLE, flexBasis: 320 }}>
              <DebtProgressCard progress={model.debtProgress} strategy={model.strategy} />
            </View>
            <View style={{ ...COLUMN_STYLE, flexBasis: 320 }}>
              <QuickActionsCard
                firstUnpaidBillId={model.firstUnpaidBillId}
                firstUnpaidBillCents={model.firstUnpaidBillCents}
                firstGoalId={model.firstGoalId}
              />
            </View>
          </View>

          <NextPaycheckCard paycheck={model.nextPaycheck} />
        </>
      )}
    </Screen>
  );
}
