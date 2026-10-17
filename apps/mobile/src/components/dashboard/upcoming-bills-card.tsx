import { formatCents, type UpcomingBill, type UpcomingBillStatus } from '@own-my-budget/core';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Caption, ChipButton, DashCard, TextLink } from '@/components/dashboard/common';
import { formatMonthDay } from '@/components/dashboard/format';
import { ThemedText } from '@/components/themed-text';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STATUS_TONE: Record<UpcomingBillStatus, StatusTone> = {
  paid: 'success',
  overdue: 'danger', // clay — genuinely overdue is the one place it appears
  partial: 'info',
  due: 'warning',
};

/** The five bills to look at next, each with its status and a Manage button that opens the payment dialog. */
export function UpcomingBillsCard({ bills }: { bills: UpcomingBill[] }) {
  const theme = useTheme();
  return (
    <DashCard
      title="Upcoming Bills and Payments"
      action={<TextLink label="View All Bills" onPress={() => router.push('/bills')} />}
    >
      {bills.length === 0 ? (
        <View style={{ gap: Space[2], alignItems: 'flex-start' }}>
          <Caption>No bills yet. Add one and it will show up here with its due date.</Caption>
          <ChipButton label="Add a Bill" onPress={() => router.push('/add-bill')} />
        </View>
      ) : (
        <View>
          {bills.map((bill, index) => (
            <View
              key={bill.id}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                columnGap: Space[3],
                rowGap: Space[2],
                paddingVertical: Space[3],
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.border,
              }}
            >
              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0, gap: 2 }}>
                <ThemedText style={{ fontFamily: Fonts.body.bold, fontSize: 15, lineHeight: 22 }}>
                  {bill.label}
                </ThemedText>
                <Caption>
                  {bill.category} · due {formatMonthDay(bill.dueDate)}
                </Caption>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Space[3],
                  flexWrap: 'wrap',
                }}
              >
                <ThemedText
                  style={{
                    fontFamily: Fonts.heading.semibold,
                    fontSize: 16,
                    lineHeight: 22,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatCents(bill.amountDueCents)}
                </ThemedText>
                <StatusPill filled label={bill.statusLabel} tone={STATUS_TONE[bill.status]} />
                <ChipButton
                  label="Manage"
                  tone="soft"
                  accessibilityLabel={`Manage ${bill.label}`}
                  onPress={() =>
                    router.push({
                      pathname: '/record-bill-payment',
                      params: { billId: bill.id, amountCents: String(bill.amountDueCents) },
                    })
                  }
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </DashCard>
  );
}
