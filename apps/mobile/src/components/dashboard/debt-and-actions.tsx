import { formatCents, type DebtProgress, type PayoffStrategy } from '@own-my-budget/core';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Bar, Caption, ChipButton, DashCard } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function Figure({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 120, gap: 2 }}>
      <Caption style={{ fontSize: 13, lineHeight: 18 }}>{label}</Caption>
      <ThemedText
        style={{
          fontFamily: Fonts.heading.semibold,
          fontSize: 18,
          lineHeight: 26,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatCents(cents)}
      </ThemedText>
    </View>
  );
}

const STRATEGY_LABEL: Record<PayoffStrategy, string> = {
  snowball: 'Snowball — smallest balance first',
  avalanche: 'Avalanche — highest interest first',
};

/** Debt Payoff Progress: totals, how much of the starting debt is cleared, and the next focus. */
export function DebtProgressCard({
  progress,
  strategy,
}: {
  progress: DebtProgress;
  strategy: PayoffStrategy;
}) {
  const theme = useTheme();
  return (
    <DashCard
      title="Debt Payoff Progress"
      action={
        <ChipButton
          label="View Debt Plan"
          tone="soft"
          onPress={() => router.push({ pathname: '/bills', params: { tab: 'payoff' } })}
        />
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
        <Figure label="Total debt balance" cents={progress.totalBalanceCents} />
        <Figure label="Paid so far" cents={progress.paidCents} />
        <Figure label="Reduced since start" cents={progress.reducedCents} />
      </View>
      <Bar percent={progress.percentCleared} color={theme.successSolid} />
      <Caption>
        {progress.percentCleared}% of your starting debt cleared · Strategy:{' '}
        {STRATEGY_LABEL[strategy]} · Next focus: {progress.nextFocusLabel ?? 'Nothing outstanding'}
      </Caption>
    </DashCard>
  );
}

export interface QuickActionsProps {
  firstUnpaidBillId: string | null;
  firstUnpaidBillCents: number;
  firstGoalId: string | null;
}

/** Six one-tap shortcuts into the flows people use most. */
export function QuickActionsCard({
  firstUnpaidBillId,
  firstUnpaidBillCents,
  firstGoalId,
}: QuickActionsProps) {
  const theme = useTheme();
  const actions: { label: string; onPress: () => void }[] = [
    { label: 'Add Income', onPress: () => router.push('/add-income') },
    { label: 'Add Expense', onPress: () => router.push('/add-transaction') },
    { label: 'Add a Bill', onPress: () => router.push('/add-bill') },
    {
      label: 'Record a Payment',
      onPress: () =>
        firstUnpaidBillId
          ? router.push({
              pathname: '/record-bill-payment',
              params: { billId: firstUnpaidBillId, amountCents: String(firstUnpaidBillCents) },
            })
          : router.push('/bills'),
    },
    {
      label: 'Add to Savings',
      onPress: () =>
        firstGoalId
          ? router.push({
              pathname: '/add-goal-activity',
              params: { goalId: firstGoalId, kind: 'deposit' },
            })
          : router.push('/add-savings-goal'),
    },
    { label: 'View Monthly Report', onPress: () => router.push('/reports') },
  ];
  return (
    <DashCard title="Quick Actions">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
        {actions.map((action) => (
          <ChipButton
            key={action.label}
            label={action.label}
            tone="soft"
            onPress={action.onPress}
            style={{
              flexGrow: 1,
              flexBasis: 150,
              minHeight: 52,
              backgroundColor: theme.background,
              alignItems: 'flex-start',
            }}
          />
        ))}
      </View>
    </DashCard>
  );
}
