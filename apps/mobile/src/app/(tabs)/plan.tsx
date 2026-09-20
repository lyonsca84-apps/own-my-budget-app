import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BudgetCategoryRowView } from '@/components/budget/budget-category-row';
import { formatPayday } from '@/components/budget/format';
import { MonthYearPicker } from '@/components/budget/month-year-picker';
import { PaydayCard } from '@/components/budget/payday-card';
import { PaySchedulesCard } from '@/components/budget/pay-schedules-card';
import { useBudgetData } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { BillRow } from '@/components/ui/bill-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Grid } from '@/components/ui/grid';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatTile } from '@/components/ui/stat-tile';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BudgetMode = 'monthly' | 'paycheck';

const MODE_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: 'monthly', label: 'Monthly budget' },
  { value: 'paycheck', label: 'Paycheck budget' },
];

export default function BudgetScreen() {
  const theme = useTheme();
  const data = useBudgetData();
  const [mode, setMode] = useState<BudgetMode>('monthly');
  const editable = !data.isGuest;
  const { summary } = data;
  const isOver = summary.remainingCents < 0;

  return (
    <Screen showGuestBanner>
      <ScreenHeader
        eyebrow="Budget"
        title="Budget"
        subtitle="Plan what's coming in and see where it goes."
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[4] }}>
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
        {mode === 'monthly' ? (
          <MonthYearPicker
            month={data.month}
            year={data.year}
            onChange={data.setPeriod}
            disabled={data.isGuest}
          />
        ) : null}
      </View>

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

      {data.hasNoData ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText type="smallBold">Let&rsquo;s set up your budget</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add your income and a few categories — planned and actual amounts, and your upcoming
            paydays, fill in from there.
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button label="Add income" variant="panel" onPress={() => router.push('/add-income')} />
            <Button
              label="Add a category"
              variant="secondary"
              onPress={() => router.push('/add-category')}
            />
          </View>
        </Card>
      ) : null}

      {mode === 'monthly' ? (
        <>
          <Grid>
            <StatTile
              label="Planned"
              valueCents={summary.plannedCents}
              glyph="◎"
              glyphColor="primary"
              glyphTint="primaryMuted"
              description={`Total planned for ${data.periodLabel}.`}
            />
            <StatTile
              label="Spent so far"
              valueCents={summary.actualCents}
              glyph="≡"
              glyphColor="textSecondary"
              glyphTint="backgroundSelected"
              description={
                summary.percentUsed !== null
                  ? `${summary.percentUsed}% of your plan.`
                  : 'Set planned amounts to see how far along you are.'
              }
            />
            <StatTile
              label={isOver ? 'Over plan' : 'Left in plan'}
              valueCents={Math.abs(summary.remainingCents)}
              glyph="●"
              glyphColor={isOver ? 'warning' : 'accent'}
              glyphTint={isOver ? 'warningMuted' : 'accentMuted'}
              trend={
                isOver
                  ? {
                      label: `Watch ${summary.overCategoryCount} ${
                        summary.overCategoryCount === 1 ? 'category' : 'categories'
                      }`,
                      tone: 'watch',
                    }
                  : undefined
              }
              description={
                isOver
                  ? 'Spending is past what you planned — a good moment to adjust.'
                  : 'Planned minus spent, across every category.'
              }
              emphasize
            />
          </Grid>

          <SectionCard
            title={`Planned vs actual — ${data.periodLabel}`}
            action={
              editable ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                  <Button
                    label="Manage"
                    variant="quiet"
                    accessibilityLabel="Manage categories"
                    onPress={() => router.push('/manage-categories')}
                  />
                  <Button
                    label="+ Add category"
                    variant="secondary"
                    onPress={() => router.push('/add-category')}
                  />
                </View>
              ) : undefined
            }
          >
            {editable ? (
              <ThemedText type="small" themeColor="textSecondary">
                Edit spent or planned amounts for {data.periodLabel} — changes save when you leave
                the field.
              </ThemedText>
            ) : null}

            {data.rows.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                {data.isLoading
                  ? 'Loading your categories…'
                  : 'No categories yet. Add one (like Groceries or Rent) to start planning this month.'}
              </ThemedText>
            ) : (
              <View>
                {data.rows.map((row, index) => (
                  <View
                    key={row.categoryId}
                    style={{
                      paddingTop: index === 0 ? 0 : Space[5],
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.border,
                    }}
                  >
                    <BudgetCategoryRowView
                      row={row}
                      periodLabel={data.periodLabel}
                      editable={editable}
                      onPlannedCommit={(cents) => data.savePlanned(row.categoryId, cents ?? 0)}
                      onActualCommit={(cents) => data.saveActual(row.categoryId, cents)}
                      onResetActual={() => data.saveActual(row.categoryId, null)}
                    />
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <PaySchedulesCard
            schedules={data.schedules}
            editable={editable}
            isLoading={data.isLoading}
          />

          <SectionCard title="Payday view">
            <ThemedText type="small" themeColor="textSecondary">
              Plan which paycheck covers each bill, card, or loan payment. Planning does not change
              any balance — only marking a payment paid does.
            </ThemedText>
            {!data.paydayPlanningAvailable ? (
              <ThemedText type="small" themeColor="warning">
                Payday planning isn&rsquo;t available on this account yet.
              </ThemedText>
            ) : null}
            {data.paydays.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                {data.isLoading
                  ? 'Loading your paydays…'
                  : 'No upcoming paydays yet. Add a pay schedule with its next pay date and your paydays will show up here.'}
              </ThemedText>
            ) : (
              <Grid>
                {data.paydays.map((payday) => (
                  <View key={payday.key} style={{ flexGrow: 1, flexBasis: 340 }}>
                    <PaydayCard
                      payday={payday}
                      targets={data.targets}
                      editable={editable && data.paydayPlanningAvailable}
                      onAssign={(target, cents) =>
                        data.assignPayment(
                          { incomeSourceId: payday.incomeSourceId, payDate: payday.payDate },
                          target,
                          cents
                        )
                      }
                      onRemove={data.removeAssignment}
                    />
                  </View>
                ))}
              </Grid>
            )}
          </SectionCard>

          {editable ? (
            <SectionCard
              title="Logged paychecks"
              action={
                <Button
                  label="+ Log a paycheck"
                  variant="secondary"
                  onPress={() => router.push('/add-paycheck')}
                />
              }
            >
              {data.paychecks.length === 0 ? (
                <ThemedText themeColor="textSecondary">
                  {data.isLoading
                    ? 'Loading your paychecks…'
                    : 'No paychecks logged yet. Log one when it lands to split it across your categories.'}
                </ThemedText>
              ) : (
                <View style={{ gap: Space[4] }}>
                  {data.paychecks.slice(0, 5).map((paycheck) => (
                    <BillRow
                      key={paycheck.id}
                      label="Paycheck"
                      caption={`Received ${formatPayday(paycheck.pay_date)}`}
                      amountCents={paycheck.amount_cents}
                      trailing={
                        paycheck.is_assigned ? (
                          <StatusPill label="Assigned" tone="success" />
                        ) : (
                          <Button
                            label="Assign"
                            variant="secondary"
                            accessibilityLabel={`Assign the paycheck received ${formatPayday(paycheck.pay_date)} to categories`}
                            onPress={() =>
                              router.push({
                                pathname: '/assign-paycheck',
                                params: { paycheckId: paycheck.id },
                              })
                            }
                          />
                        )
                      }
                    />
                  ))}
                </View>
              )}
            </SectionCard>
          ) : null}
        </>
      )}
    </Screen>
  );
}
