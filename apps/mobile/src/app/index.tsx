import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DEMO_DATA,
  formatCents,
  sumDebtBalances,
  sumSavingsSaved,
  sumUnpaidBills,
  type BillStatus,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
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
  const { profile, account, incomeSources, bills } = DEMO_DATA;
  const unpaidBillsTotal = sumUnpaidBills(DEMO_DATA);
  const debtTotal = sumDebtBalances(DEMO_DATA);
  const savingsTotal = sumSavingsSaved(DEMO_DATA);
  const nextPaycheck = incomeSources[0];
  // Overdue bills surface first — this list is "what needs attention", not just chronological order.
  const billPriority: Record<BillStatus, number> = { overdue: 0, upcoming: 1, paid: 2 };
  const upcomingBills = bills
    .filter((b) => b.status !== 'paid')
    .sort((a, b) => billPriority[a.status] - billPriority[b.status])
    .slice(0, 4);

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
            <View>
              <ThemedText type="title" style={{ fontSize: 28, lineHeight: 34 }}>
                Hello, {profile.displayName}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.half }}>
                Here&apos;s a clear look at your money right now.
              </ThemedText>
            </View>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: Spacing.three,
              }}
            >
              <SummaryCard label="Bank balance" value={formatCents(account.balanceCents)} />
              <SummaryCard label="Bills left to pay" value={formatCents(unpaidBillsTotal)} />
              <SummaryCard label="Total saved" value={formatCents(savingsTotal)} />
              <SummaryCard label="Total owed" value={formatCents(debtTotal)} />
            </View>

            {nextPaycheck && (
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
                      {formatCents(nextPaycheck.amountCents)}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">
                      {nextPaycheck.label}
                    </ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" type="small">
                    {nextPaycheck.nextPayDate}
                  </ThemedText>
                </View>
              </Card>
            )}

            <Card style={{ gap: Spacing.three }}>
              <ThemedText type="smallBold">Bills that need attention</ThemedText>
              {upcomingBills.map((bill) => (
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
