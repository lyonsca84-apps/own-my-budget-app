import { formatCents, type GoalBarTone } from '@own-my-budget/core';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Bar, Caption, ChipButton, DashCard } from '@/components/dashboard/common';
import { formatLongDate } from '@/components/dashboard/format';
import type { DashboardGoal } from '@/components/dashboard/model';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Savings Goals: up to three open goals with progress, plus Add / Manage / View. */
export function GoalsCard({ goals }: { goals: DashboardGoal[] }) {
  const theme = useTheme();
  const barColor: Record<GoalBarTone, string> = {
    primary: theme.primary,
    accent: theme.accent,
    energy: theme.energy,
    success: theme.successSolid,
  };
  return (
    <DashCard title="Savings Goals">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
        <ChipButton
          label="Add Savings Goal"
          tone="green"
          onPress={() => router.push('/add-savings-goal')}
        />
        <ChipButton label="Manage Goals" tone="soft" onPress={() => router.push('/money')} />
        <ChipButton label="View Savings" tone="soft" onPress={() => router.push('/money')} />
      </View>
      {goals.length === 0 ? (
        <Caption>
          No open savings goals yet. Start one — even a small target gives your savings a direction.
        </Caption>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] }}>
          {goals.map((goal) => (
            <View
              key={goal.id}
              style={{
                flexGrow: 1,
                flexBasis: 240,
                minWidth: 0,
                backgroundColor: theme.background,
                borderRadius: Radius.card,
                padding: Space[4],
                gap: Space[2],
              }}
            >
              <ThemedText
                style={{ fontFamily: Fonts.heading.semibold, fontSize: 16, lineHeight: 22 }}
              >
                {goal.label}
              </ThemedText>
              <Caption>
                Target {formatCents(goal.targetCents)} by{' '}
                {goal.targetDate ? formatLongDate(goal.targetDate) : 'no date set'}
              </Caption>
              <View style={{ marginTop: Space[1] }}>
                <Bar percent={goal.percent} color={barColor[goal.tone]} />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  columnGap: Space[3],
                }}
              >
                <Caption bold color="text">
                  {formatCents(goal.savedCents)} saved
                </Caption>
                <Caption>
                  {goal.percent}% · {formatCents(goal.remainingCents)} to go
                </Caption>
              </View>
            </View>
          ))}
        </View>
      )}
    </DashCard>
  );
}
