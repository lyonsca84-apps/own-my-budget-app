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
import { SetupCard } from '@/components/dashboard/setup-card';
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
          <SetupCard
            isEmpty={model.isEmpty}
            missing={model.setupMissing}
            userId={status === 'signedIn' ? (user?.id ?? null) : null}
          />

          <SummaryCards
            cards={[
              {
                label: 'Total Income',
                cents: model.setupMissing.includes('income') ? null : model.income.cents,
                glyph: '↗',
                glyphColor: 'solidAccent',
                glyphTint: 'accentMuted',
                note: model.income.change,
                help: 'Take-home pay expected from your pay schedules this month.',
              },
              {
                label: 'Bills and Payments',
                cents:
                  model.setupMissing.includes('bills') && model.setupMissing.includes('debts')
                    ? null
                    : model.billsAndPayments.cents,
                glyph: '≡',
                glyphColor: 'text',
                glyphTint: 'backgroundSelected',
                note: {
                  text: model.setupMissing.includes('bills')
                    ? 'Add your bills when you’re ready'
                    : `${model.billsAndPayments.paidCount} of ${model.billsAndPayments.totalCount} bills paid`,
                  tone: 'neutral',
                },
                help: 'Everything due this month across bills, cards and loans.',
              },
              {
                label: 'Savings',
                cents: model.setupMissing.includes('goals') ? null : model.savings.cents,
                glyph: '◆',
                glyphColor: 'success',
                glyphTint: 'successMuted',
                note: model.setupMissing.includes('goals')
                  ? { text: 'Add a savings goal when you’re ready', tone: 'neutral' }
                  : model.savings.change,
                help: 'Money you moved into savings goals this month.',
              },
              {
                label: 'Money Available',
                cents: model.setupMissing.includes('income') ? null : model.available.cents,
                glyph: '●',
                glyphColor: 'primary',
                glyphTint: 'primaryMuted',
                note: model.setupMissing.includes('income')
                  ? { text: 'Add income to see this amount', tone: 'neutral' }
                  : model.setupMissing.includes('bills')
                    ? { text: 'Based on what you’ve added so far', tone: 'neutral' }
                    : model.available.change,
                help: 'Income left after recorded bills, debt, spending and savings. This is not your bank balance.',
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
                setupMissing={model.setupMissing}
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
