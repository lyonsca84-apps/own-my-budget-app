import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCents, type BillStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

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
  const data = useDashboardData();
  const avatarName = status === 'signedIn' ? (user?.email ?? data.displayName) : data.displayName;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.five }}>
          <View
            style={{
              width: '100%',
              maxWidth: MaxContentWidth,
              alignSelf: 'center',
              padding: Spacing.four,
              gap: Spacing.four,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <ThemedText type="title" style={{ fontSize: 28, lineHeight: 34 }}>
                  Hello, {data.displayName || 'there'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.half }}>
                  Here&apos;s a clear look at your money right now.
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => router.push('/settings')}
              >
                <Avatar name={avatarName} />
              </Pressable>
            </View>

            {data.isLoading ? (
              <Card>
                <ThemedText themeColor="textSecondary">Loading your budget…</ThemedText>
              </Card>
            ) : data.hasNoData ? (
              <EmptyState
                title="Let's build your budget picture"
                message="Add your income and your first bill to see your money left to spend."
              />
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three }}>
                  <SummaryCard label="Bank balance" value={formatCents(data.balanceCents)} />
                  <SummaryCard
                    label="Bills left to pay"
                    value={formatCents(data.unpaidBillsCents)}
                  />
                  <SummaryCard label="Total saved" value={formatCents(data.savingsTotalCents)} />
                  <SummaryCard label="Total owed" value={formatCents(data.debtTotalCents)} />
                </View>

                <Card>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    MONEY LEFT TO SPEND
                  </ThemedText>
                  <ThemedText type="title" style={{ fontSize: 26, marginTop: Spacing.one }}>
                    {formatCents(data.moneyLeftToSpendCents)}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={{ marginTop: Spacing.half }}
                  >
                    Bank balance minus bills you still owe.
                  </ThemedText>
                </Card>

                {data.nextPaycheck && (
                  <Card>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      NEXT PAYCHECK
                    </ThemedText>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginTop: Spacing.one,
                      }}
                    >
                      <View>
                        <ThemedText type="title" style={{ fontSize: 22 }}>
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
                  </Card>
                )}

                {data.billsNeedingAttention.length > 0 && (
                  <Card style={{ gap: Spacing.three }}>
                    <ThemedText type="smallBold">Bills that need attention</ThemedText>
                    {data.billsNeedingAttention.map((bill) => (
                      <View
                        key={bill.id}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <View>
                          <ThemedText>{bill.label}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            Due {bill.dueDate}
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <ThemedText style={{ fontWeight: '700' }}>
                            {formatCents(bill.amountCents)}
                          </ThemedText>
                          <StatusPill
                            label={BILL_STATUS_LABEL[bill.status]}
                            tone={BILL_STATUS_TONE[bill.status]}
                          />
                        </View>
                      </View>
                    ))}
                  </Card>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 150, gap: Spacing.one }}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="title" style={{ fontSize: 22 }}>
        {value}
      </ThemedText>
    </Card>
  );
}
