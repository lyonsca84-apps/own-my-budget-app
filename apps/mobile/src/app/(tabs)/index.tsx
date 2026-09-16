import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { formatCents, type BillStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { BillRow } from '@/components/ui/bill-row';
import { BudgetHealthGauge } from '@/components/ui/budget-health-gauge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GreetingHero } from '@/components/ui/greeting-hero';
import { Grid } from '@/components/ui/grid';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { supabase } from '@/lib/supabase';
import { rescheduleAllNotifications } from '@/lib/notifications';
import { Space } from '@/constants/theme';

const BILL_STATUS_TONE: Record<BillStatus, StatusTone> = {
  paid: 'success',
  upcoming: 'neutral',
  overdue: 'warning', // amber, never red — PLAN.md's "never shame" rule
};

const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  paid: 'Paid',
  upcoming: 'Upcoming',
  overdue: 'Watch this',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function HomeScreen() {
  const { status, user } = useAuth();
  const data = useDashboardData();

  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    // Keeps scheduled bill/payday reminders in sync with current data.
    // Best-effort: a failure here (permission denied, etc.) must never
    // break the Home screen itself.
    rescheduleAllNotifications(supabase, user.id).catch(() => {});
  }, [status, user]);

  const maxCashFlowCents = Math.max(data.cashFlow.incomeCents, data.cashFlow.spendingCents, 1);

  return (
    <Screen showGuestBanner>
      <GreetingHero
        eyebrow="Dashboard"
        title={`Hello, ${data.displayName || 'there'}`}
        subtitle="Here's a clear look at your money right now."
        action={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
              onPress={data.refresh}
              hitSlop={8}
            >
              <ThemedText style={{ fontSize: 18 }}>⟳</ThemedText>
            </Pressable>
            <MonthYearStepper
              month={data.selectedMonth}
              year={data.selectedYear}
              onMonthChange={data.setSelectedMonth}
              onYearChange={data.setSelectedYear}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
            >
              <Avatar name={data.displayName} />
            </Pressable>
            <Button label="+ Add Transaction" onPress={() => router.push('/add-transaction')} />
          </View>
        }
      />

      {data.isLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading your budget…</ThemedText>
        </Card>
      ) : (
        <>
          {data.hasNoData && (
            <Card style={{ gap: Space[1] }}>
              <ThemedText type="smallBold">Let&rsquo;s build your budget picture</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Add your income and your first bill — the cards below will fill in with your real
                numbers as you go.
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: Space[2] }}>
                <Button
                  label="Add income"
                  variant="panel"
                  onPress={() => router.push('/add-income')}
                />
                <Button
                  label="Add a bill"
                  variant="secondary"
                  onPress={() => router.push('/add-bill')}
                />
              </View>
            </Card>
          )}

          <Grid>
            <StatTile
              label="Total Income"
              valueCents={data.cashFlow.incomeCents}
              glyph="↗"
              glyphColor="primary"
              glyphTint="primaryMuted"
              description="Take-home pay this month."
            />
            <StatTile
              label="Bills and Payments"
              valueCents={data.unpaidBillsCents}
              glyph="≡"
              glyphColor="textSecondary"
              glyphTint="backgroundSelected"
              description={
                data.billsTotalCount > 0
                  ? `${data.billsPaidCount} of ${data.billsTotalCount} bills paid — what's left to pay.`
                  : 'Add a bill to start tracking what you owe.'
              }
            />
            <StatTile
              label="Savings"
              valueCents={data.savingsTotalCents}
              glyph="◆"
              glyphColor="success"
              glyphTint="successMuted"
              description="Total saved across your goals."
            />
            <StatTile
              label="Money Available"
              valueCents={data.moneyLeftToSpendCents}
              glyph="●"
              glyphColor="accent"
              glyphTint="accentMuted"
              description="What's left after bills, debt, and spending."
              emphasize
            />
          </Grid>

          <Grid>
            <View style={{ flexGrow: 1, flexBasis: 320 }}>
              <SectionCard
                title="Monthly Cash Flow"
                action={
                  <ThemedText type="small" themeColor="textSecondary">
                    {MONTH_NAMES[data.selectedMonth]} {data.selectedYear}
                  </ThemedText>
                }
              >
                <View style={{ gap: Space[2] }}>
                  <ProgressBar
                    percent={(data.cashFlow.incomeCents / maxCashFlowCents) * 100}
                    tone="success"
                  />
                  <ProgressBar
                    percent={(data.cashFlow.spendingCents / maxCashFlowCents) * 100}
                    tone="watch"
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCents(data.cashFlow.incomeCents)} in ·{' '}
                    {formatCents(data.cashFlow.spendingCents)} out
                  </ThemedText>
                </View>
              </SectionCard>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 320 }}>
              <BudgetHealthGauge health={data.budgetHealth} />
            </View>
          </Grid>

          {data.nextPaycheck && (
            <SectionCard title="Next paycheck">
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <View>
                  <ThemedText type="amountSmall">
                    {formatCents(data.nextPaycheck.amountCents)}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {data.nextPaycheck.label}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary" type="small">
                  {data.nextPaycheck.payDate}
                </ThemedText>
              </View>
            </SectionCard>
          )}

          {data.billsNeedingAttention.length > 0 && (
            <SectionCard title="Bills that need attention">
              <View style={{ gap: Space[4] }}>
                {data.billsNeedingAttention.map((bill) => (
                  <BillRow
                    key={bill.id}
                    label={bill.label}
                    caption={`Due ${bill.dueDate}`}
                    amountCents={bill.amountCents}
                    trailing={
                      <StatusPill
                        label={BILL_STATUS_LABEL[bill.status]}
                        tone={BILL_STATUS_TONE[bill.status]}
                      />
                    }
                  />
                ))}
              </View>
            </SectionCard>
          )}

          <SectionCard title="Quick actions">
            <Grid gap={Space[2]}>
              <View style={{ flexGrow: 1, flexBasis: 150 }}>
                <Button
                  label="+ Add bill"
                  variant="secondary"
                  onPress={() => router.push('/add-bill')}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 150 }}>
                <Button
                  label="+ Add income"
                  variant="secondary"
                  onPress={() => router.push('/add-income')}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 150 }}>
                <Button
                  label="+ Add goal"
                  variant="secondary"
                  onPress={() => router.push('/add-savings-goal')}
                />
              </View>
            </Grid>
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

function MonthYearStepper({
  month,
  year,
  onMonthChange,
  onYearChange,
}: {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: Space[1] }}>
      <Stepper
        label={MONTH_NAMES[month]}
        onPrev={() => onMonthChange(month === 0 ? 11 : month - 1)}
        onNext={() => onMonthChange(month === 11 ? 0 : month + 1)}
      />
      <Stepper
        label={String(year)}
        onPrev={() => onYearChange(year - 1)}
        onNext={() => onYearChange(year + 1)}
      />
    </View>
  );
}

function Stepper({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space[1],
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: Space[3],
        paddingHorizontal: Space[2],
        paddingVertical: Space[1],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous ${label}`}
        onPress={onPrev}
        hitSlop={6}
      >
        <ThemedText type="small">‹</ThemedText>
      </Pressable>
      <ThemedText type="small" style={{ minWidth: 34, textAlign: 'center' }}>
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next ${label}`}
        onPress={onNext}
        hitSlop={6}
      >
        <ThemedText type="small">›</ThemedText>
      </Pressable>
    </View>
  );
}
