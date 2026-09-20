import { View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { formatShortDate } from '@/components/savings/format';
import type { ChallengeView } from '@/components/savings/use-savings-data';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ChallengeDetailsProps {
  challenge: ChallengeView;
  readOnly?: boolean;
  onEdit: () => void;
}

const MODE_LABEL: Record<ChallengeView['challengeType'], string> = {
  classic_ascending: 'Classic — $1, $2, $3…',
  flat: 'Flat — the same each week',
  reverse: 'Reverse — big weeks first',
  custom: 'Custom',
};

/**
 * The expanded body of the 52-week challenge card: dates, then the weeks in
 * five-week blocks. A week is "done" once the challenge's saved total covers
 * it, and each shows a text mark (not just a color) so status never relies on hue alone.
 */
export function ChallengeDetails({ challenge, readOnly, onEdit }: ChallengeDetailsProps) {
  const theme = useTheme();
  const currentWeek = Math.min(challenge.weeksDone + 1, challenge.totalWeeks);

  return (
    <View style={{ gap: Space[3] }}>
      <View style={{ height: 1, backgroundColor: theme.border }} />
      <View style={{ gap: Space[1] }}>
        <ThemedText type="small" themeColor="textSecondary">
          Week {currentWeek} of {challenge.totalWeeks} · {MODE_LABEL[challenge.challengeType]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Start {formatShortDate(challenge.startDate)} · Ends {formatShortDate(challenge.endDate)}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="primary">
          {challenge.blocksDone} of {challenge.blocks.length} blocks completed
        </ThemedText>
      </View>

      {!readOnly ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
          <Button label="Edit challenge" variant="secondary" onPress={onEdit} />
        </View>
      ) : null}

      <View style={{ gap: Space[3] }}>
        {challenge.blocks.map((block) => (
          <View key={block.index} style={{ gap: Space[2] }}>
            <ThemedText type="smallBold">
              Block {block.index} · weeks {block.startWeek}–{block.endWeek}
              {block.allDone ? ' · complete' : ` · ${block.doneCount}/${block.weeks.length}`}
            </ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
              {block.weeks.map((week) => {
                const isNext = !week.done && week.week === challenge.next?.week;
                return (
                  <View
                    key={week.week}
                    accessible
                    accessibilityLabel={`Week ${week.week}, ${formatCents(week.amountCents)}, ${week.done ? 'done' : isNext ? 'next up' : 'not yet'}`}
                    style={{
                      minWidth: 72,
                      paddingVertical: Space[1],
                      paddingHorizontal: Space[2],
                      borderRadius: Radius.chip,
                      borderWidth: isNext ? 2 : 1,
                      borderColor: isNext ? theme.primary : theme.border,
                      backgroundColor: week.done ? theme.successMuted : theme.backgroundSelected,
                    }}
                  >
                    <ThemedText
                      type="small"
                      themeColor={week.done ? 'success' : 'textSecondary'}
                      style={{ fontSize: 13, lineHeight: 18 }}
                    >
                      {week.done ? '✓ ' : ''}Wk {week.week}
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ fontSize: 13, lineHeight: 18 }}>
                      {formatCents(week.amountCents)}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
