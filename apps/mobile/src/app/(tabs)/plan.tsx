import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatCentsCompact } from '@own-my-budget/core';

import { BudgetCard } from '@/components/budget/budget-card';
import { BudgetCategoryRowView } from '@/components/budget/budget-category-row';
import { formatPayday } from '@/components/budget/format';
import { PaydayCard } from '@/components/budget/payday-card';
import { PaySchedulesCard } from '@/components/budget/pay-schedules-card';
import { MONTH_NAMES, useBudgetData } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { BillRow } from '@/components/ui/bill-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { PageTabs } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BudgetMode = 'monthly' | 'paycheck';

const MODE_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: 'monthly', label: 'Monthly budget' },
  { value: 'paycheck', label: 'Paycheck budget' },
];

const MONTH_OPTIONS = MONTH_NAMES.map((name, index) => ({ value: String(index), label: name }));

export default function BudgetScreen() {
  const theme = useTheme();
  const data = useBudgetData();
  const [mode, setMode] = useState<BudgetMode>('monthly');

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const first = Math.min(current - 3, data.year);
    const last = Math.max(current + 3, data.year);
    return Array.from({ length: last - first + 1 }, (_, i) => {
      const value = String(first + i);
      return { value, label: value };
    });
  }, [data.year]);

  return (
    <Screen showGuestBanner>
      <PageHeader
        title="Budget"
        subtitle="Plan by month or by paycheck."
        right={
          <>
            <View style={{ width: 120 }}>
              <SelectField
                label="Year"
                hideLabel
                compact
                value={String(data.year)}
                options={yearOptions}
                onChange={(year) => data.setPeriod(data.month, Number(year))}
              />
            </View>
            <View style={{ width: 160 }}>
              <SelectField
                label="Month"
                hideLabel
                compact
                value={String(data.month)}
                options={MONTH_OPTIONS}
                onChange={(month) => data.setPeriod(Number(month), data.year)}
              />
            </View>
          </>
        }
      />

      <PageTabs
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Budget view"
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

      {data.hasNoData ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText type="smallBold">Let&rsquo;s set up your budget</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add your income and a few categories — planned and actual amounts, and your upcoming
            paydays, fill in from there.
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button
              label="Add income"
              size="sm"
              shape="rounded"
              onPress={() => router.push('/add-income')}
            />
            <Button
              label="Add a category"
              variant="soft"
              size="sm"
              shape="rounded"
              onPress={() => router.push('/add-category')}
            />
          </View>
        </Card>
      ) : null}

      {mode === 'monthly' ? (
        <BudgetCard
          title={`Planned vs actual — ${data.periodLabel}`}
          action={
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
              <Button
                label="Manage"
                variant="soft"
                size="sm"
                shape="rounded"
                accessibilityLabel="Manage categories"
                onPress={() => router.push('/manage-categories')}
              />
              <Button
                label="+ Add category"
                size="sm"
                shape="rounded"
                onPress={() => router.push('/add-category')}
              />
            </View>
          }
        >
          {data.rows.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              {data.isLoading
                ? 'Loading your categories…'
                : 'No categories yet. Add one (like Groceries or Rent) to start planning this month.'}
            </ThemedText>
          ) : (
            <View style={{ gap: Space[5] }}>
              {data.rows.map((row, index) => (
                <BudgetCategoryRowView
                  key={row.categoryId}
                  row={row}
                  bar={data.bars[index]}
                  periodLabel={data.periodLabel}
                  onPlannedCommit={(cents) => data.savePlanned(row.categoryId, cents ?? 0)}
                  onActualCommit={(cents) => data.saveActual(row.categoryId, cents)}
                  onResetActual={() => data.saveActual(row.categoryId, null)}
                />
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Total planned {formatCentsCompact(data.summary.plannedCents)} · spent{' '}
                {formatCentsCompact(data.summary.actualCents)}
                {data.summary.remainingCents < 0
                  ? ` · ${formatCentsCompact(-data.summary.remainingCents)} over plan`
                  : ` · ${formatCentsCompact(data.summary.remainingCents)} left in plan`}
                . Changes save when you leave a field.
              </ThemedText>
            </View>
          )}
        </BudgetCard>
      ) : (
        <>
          <PaySchedulesCard schedules={data.schedules} isLoading={data.isLoading} />

          <BudgetCard title="Payday view">
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: -Space[2] }}>
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
              <View style={{ gap: Space[4] }}>
                {data.paydays.map((payday) => (
                  <PaydayCard
                    key={payday.key}
                    payday={payday}
                    targets={data.targets}
                    onAssign={(target, cents) =>
                      data.assignPayment(
                        { incomeSourceId: payday.incomeSourceId, payDate: payday.payDate },
                        target,
                        cents
                      )
                    }
                    onRemove={data.removeAssignment}
                  />
                ))}
              </View>
            )}
          </BudgetCard>

          <BudgetCard
            title="Logged paychecks"
            action={
              <Button
                label="+ Log a paycheck"
                variant="soft"
                size="sm"
                shape="rounded"
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
                          variant="soft"
                          size="sm"
                          shape="rounded"
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
          </BudgetCard>
        </>
      )}
    </Screen>
  );
}
