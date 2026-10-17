import { Stack } from 'expo-router';
import { View } from 'react-native';
import {
  calculateMonthlyTrend,
  formatCents,
  formatLocalDate,
  monthDateRange,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { formatMonthKey } from '@/components/reports/format';
import { useReportData } from '@/components/reports/use-report-data';
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

const MONTHS_BACK = 6;

export default function ReportIncomeExpensesScreen() {
  const { gate, isLoading: isGateLoading } = useReportsGate();
  const canView = gate?.allowed === true;

  const now = new Date();
  const range = {
    fromDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1)),
    toDate: monthDateRange(now.getFullYear(), now.getMonth()).toDate,
  };
  const data = useReportData(range, canView);

  const income = calculateMonthlyTrend(
    data.incomeEntries.map((e) => ({ occurredOn: e.date, amountCents: e.amountCents })),
    MONTHS_BACK
  );
  // "Went out" here is bills + debt + groceries — goal deposits move money
  // between your own pockets, so they're not counted as spending.
  const expenses = calculateMonthlyTrend(
    data.entries.map((e) => ({ occurredOn: e.date, amountCents: e.amountCents })),
    MONTHS_BACK
  );

  const maxCents = Math.max(
    ...income.map((m) => m.totalCents),
    ...expenses.map((m) => m.totalCents),
    1
  );
  const totalIn = income.reduce((sum, m) => sum + m.totalCents, 0);
  const totalOut = expenses.reduce((sum, m) => sum + m.totalCents, 0);
  const hasAnyData = totalIn > 0 || totalOut > 0;

  return (
    <Screen showGuestBanner>
      <Stack.Screen options={{ title: 'Income vs. expenses' }} />
      <ScreenHeader
        title="Income vs. expenses"
        subtitle={`The last ${MONTHS_BACK} months, month by month.`}
      />

      {isGateLoading || data.isLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </Card>
      ) : !canView ? (
        <LimitNotice
          title="Full reports are on a higher plan"
          reason={gate?.reason ?? "We couldn't check your plan just now. Please try again."}
        />
      ) : data.errorMessage ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText themeColor="warning">{data.errorMessage}</ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Button label="Try again" variant="secondary" onPress={data.refresh} />
          </View>
        </Card>
      ) : !hasAnyData ? (
        <EmptyState
          mascot
          title="Nothing recorded yet"
          message="Log a paycheck and record a bill, debt payment or grocery receipt to see the trend build up here."
        />
      ) : (
        <>
          <Grid>
            <StatTile
              label="Came in"
              valueCents={totalIn}
              glyph="↗"
              glyphColor="success"
              glyphTint="successMuted"
              description={`Paychecks over ${MONTHS_BACK} months.`}
            />
            <StatTile
              label="Went out"
              valueCents={totalOut}
              glyph="≡"
              glyphColor="warning"
              glyphTint="warningMuted"
              description="Bills, debt and groceries."
            />
          </Grid>

          {income.map((month, index) => {
            const out = expenses[index]?.totalCents ?? 0;
            const net = month.totalCents - out;
            return (
              <SectionCard
                key={month.month}
                title={formatMonthKey(month.month)}
                action={
                  <ThemedText type="smallBold" themeColor={net >= 0 ? 'success' : 'warning'}>
                    {net >= 0 ? 'Left over ' : 'Ahead of income by '}
                    {formatCents(Math.abs(net))}
                  </ThemedText>
                }
              >
                <View style={{ gap: Space[3] }}>
                  <View style={{ gap: Space[1] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <ThemedText type="small">Came in</ThemedText>
                      <ThemedText type="smallBold">{formatCents(month.totalCents)}</ThemedText>
                    </View>
                    <ProgressBar percent={(month.totalCents / maxCents) * 100} tone="success" />
                  </View>
                  <View style={{ gap: Space[1] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <ThemedText type="small">Went out</ThemedText>
                      <ThemedText type="smallBold">{formatCents(out)}</ThemedText>
                    </View>
                    <ProgressBar percent={(out / maxCents) * 100} tone="watch" />
                  </View>
                </View>
              </SectionCard>
            );
          })}
        </>
      )}
    </Screen>
  );
}
