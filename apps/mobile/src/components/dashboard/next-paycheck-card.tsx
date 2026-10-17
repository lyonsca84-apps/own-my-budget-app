import { formatCents } from '@own-my-budget/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Caption, CARD_PADDING } from '@/components/dashboard/common';
import type { DashboardPaycheck } from '@/components/dashboard/model';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Space } from '@/constants/theme';

/** The next paycheck strip; tapping it opens the Budget page's paycheck view. */
export function NextPaycheckCard({ paycheck }: { paycheck: DashboardPaycheck | null }) {
  const open = () => router.push({ pathname: '/plan', params: { view: 'paycheck' } });
  const isOver = paycheck ? paycheck.remainingCents < 0 : false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        paycheck
          ? `Next paycheck ${paycheck.dateLabel}, ${paycheck.sourceLabel}. Open paycheck budget.`
          : 'No pay schedule yet. Open paycheck budget.'
      }
      onPress={open}
    >
      <Card
        style={{
          padding: CARD_PADDING,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: Space[4],
        }}
      >
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Caption bold style={{ fontSize: 13, letterSpacing: 0.6 }}>
            NEXT PAYCHECK
          </Caption>
          <ThemedText style={{ fontFamily: Fonts.heading.bold, fontSize: 20, lineHeight: 28 }}>
            {paycheck
              ? `${paycheck.dateLabel} · ${paycheck.sourceLabel}`
              : 'No active pay schedule'}
          </ThemedText>
          <Caption>
            {paycheck
              ? `${formatCents(paycheck.amountCents)} expected · ${paycheck.assignedCount} payment(s) assigned`
              : 'Add income to see your next payday.'}
          </Caption>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <ThemedText
            themeColor={isOver ? 'warning' : paycheck ? 'success' : 'textSecondary'}
            style={{
              fontFamily: Fonts.heading.bold,
              fontSize: 22,
              lineHeight: 30,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCents(paycheck ? paycheck.remainingCents : 0)}
          </ThemedText>
          <Caption>remaining after planned payments</Caption>
        </View>
      </Card>
    </Pressable>
  );
}
