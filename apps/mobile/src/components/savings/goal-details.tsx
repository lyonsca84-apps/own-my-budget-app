import { View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { formatShortDate } from '@/components/savings/format';
import type { GoalActivityView, GoalView } from '@/components/savings/use-savings-data';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface GoalDetailsProps {
  goal: GoalView;
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** The expanded body of a goal card: dates, pace suggestion, edit/delete, and recent deposit history. */
export function GoalDetails({ goal, readOnly, onEdit, onDelete }: GoalDetailsProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: Space[3] }}>
      <View style={{ height: 1, backgroundColor: theme.border }} />
      <View style={{ gap: Space[1] }}>
        <ThemedText type="small" themeColor="textSecondary">
          Start {formatShortDate(goal.startDate)} · Target{' '}
          {goal.targetDate ? formatShortDate(goal.targetDate) : 'no date set'}
        </ThemedText>
        {goal.suggestedMonthlyCents !== null ? (
          <ThemedText type="smallBold" themeColor="primary">
            About {formatCents(goal.suggestedMonthlyCents)} a month keeps you on pace.
          </ThemedText>
        ) : null}
      </View>

      {!readOnly ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
          <Button label="Edit" variant="secondary" onPress={onEdit} />
          <Button
            label="Delete goal"
            variant="quiet"
            onPress={onDelete}
            accessibilityLabel={`Delete ${goal.title}`}
          />
        </View>
      ) : null}

      <View style={{ height: 1, backgroundColor: theme.border }} />
      <ThemedText type="smallBold" themeColor="primary">
        Deposit history
      </ThemedText>
      {goal.recentActivity.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No deposits recorded yet.
        </ThemedText>
      ) : (
        goal.recentActivity.map((entry) => <ActivityLine key={entry.id} entry={entry} />)
      )}
    </View>
  );
}

function ActivityLine({ entry }: { entry: GoalActivityView }) {
  const isWithdrawal = entry.kind === 'withdrawal';
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: Space[2],
      }}
    >
      <ThemedText type="small">
        <ThemedText type="smallBold">{formatShortDate(entry.occurredOn)}</ThemedText>
        {' · '}
        {isWithdrawal ? 'Withdrawal' : 'Deposit'}
        {entry.note ? ` · ${entry.note}` : ''}
      </ThemedText>
      <ThemedText type="smallBold">
        {isWithdrawal ? '−' : '+'}
        {formatCents(entry.amountCents)}
      </ThemedText>
    </View>
  );
}
