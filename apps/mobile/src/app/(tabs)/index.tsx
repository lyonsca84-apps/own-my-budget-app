import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { type BillStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { BillRow } from '@/components/ui/bill-row';
import { BudgetHealthGauge } from '@/components/ui/budget-health-gauge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyText } from '@/components/ui/currency-text';
import { EmptyState } from '@/components/ui/empty-state';
import { GreetingHero } from '@/components/ui/greeting-hero';
import { Grid } from '@/components/ui/grid';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useTheme } from '@/hooks/use-theme';
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

export default function HomeScreen() {
  const { status, user } = useAuth();
  const theme = useTheme();
  const data = useDashboardData();
  const avatarName = status === 'signedIn' ? (user?.email ?? data.displayName) : data.displayName;

  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    // Keeps scheduled bill/payday reminders in sync with current data.
    // Best-effort: a failure here (permission denied, etc.) must never
    // break the Home screen itself.
    rescheduleAllNotifications(supabase, user.id).catch(() => {});
  }, [status, user]);

  return (
    <Screen showGuestBanner>
      <GreetingHero
        eyebrow="Dashboard"
        title={`Hello, ${data.displayName || 'there'}`}
        subtitle="Here's a clear look at your money right now."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          >
            <Avatar name={avatarName} />
          </Pressable>
        }
      />

      {data.isLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading your budget…</ThemedText>
        </Card>
      ) : data.hasNoData ? (
        <EmptyState
          title="Let's build your budget picture"
          message="Add your income and your first bill to see your money left to spend."
          mascot
          action={
            <Button label="Add income" variant="panel" onPress={() => router.push('/add-income')} />
          }
        />
      ) : (
        <>
          {/* The one hero number on this screen — Energy outline, per the handoff's "one emphasis per screen" rule. */}
          <Card style={{ gap: Space[1], borderWidth: 2, borderColor: theme.energy }}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Money left to spend
            </ThemedText>
            <CurrencyText cents={data.moneyLeftToSpendCents} size="display" />
            <ThemedText type="small" themeColor="textSecondary">
              Bank balance minus bills you still owe.
            </ThemedText>
          </Card>

          <Grid>
            <StatTile
              label="Bank balance"
              valueCents={data.balanceCents}
              glyph="↗"
              glyphColor="primary"
              glyphTint="primaryMuted"
            />
            <StatTile
              label="Bills left to pay"
              valueCents={data.unpaidBillsCents}
              glyph="≡"
              glyphColor="textSecondary"
              glyphTint="backgroundSelected"
            />
            <StatTile
              label="Total saved"
              valueCents={data.savingsTotalCents}
              glyph="◆"
              glyphColor="success"
              glyphTint="successMuted"
            />
            <StatTile
              label="Total owed"
              valueCents={data.debtTotalCents}
              glyph="●"
              glyphColor="accent"
              glyphTint="accentMuted"
            />
          </Grid>

          <BudgetHealthGauge health={data.budgetHealth} />

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
                  <CurrencyText cents={data.nextPaycheck.amountCents} size="row" />
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
