import { useState } from 'react';
import { View } from 'react-native';
import {
  SAVINGS_ACTIVITY_LABELS,
  filterSavingsActivity,
  type SavingsActivityEvent,
  type SavingsActivityFilter,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { formatActivityDate, formatMoney } from '@/components/savings/format';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FILTERS: { value: SavingsActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'goals', label: 'Goals' },
  { value: 'challenges', label: 'Challenges' },
];

const PAGE = 10;

/** Recent Savings Activity: deposits, goals created/completed, challenge weeks and badges earned — filterable, newest first. */
export function ActivitySection({ activity }: { activity: SavingsActivityEvent[] }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<SavingsActivityFilter>('all');
  const [showAll, setShowAll] = useState(false);

  const filtered = filterSavingsActivity(activity, filter);
  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  return (
    <SectionCard
      title="Recent Savings Activity"
      action={
        <SegmentedControl
          options={FILTERS}
          value={filter}
          variant="chips"
          size="sm"
          accessibilityLabel="Filter savings activity"
          onChange={(value) => {
            setFilter(value);
            setShowAll(false);
          }}
        />
      }
    >
      {visible.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: 24 }}>
          No recent savings activity.
        </ThemedText>
      ) : (
        <View>
          {visible.map((entry, index) => (
            <View
              key={entry.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: Space[3],
                paddingVertical: Space[3],
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.border,
              }}
            >
              <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
                <ThemedText type="smallBold">{entry.title}</ThemedText>
                {' · '}
                {SAVINGS_ACTIVITY_LABELS[entry.kind]}
                {' · '}
                {formatActivityDate(entry.date)}
                {entry.note && entry.kind !== 'challengeDeposit' ? ` · ${entry.note}` : ''}
              </ThemedText>
              {entry.amountCents !== null && entry.kind !== 'goalCompleted' ? (
                <ThemedText type="smallBold">
                  {entry.kind === 'withdrawal' ? '−' : ''}
                  {formatMoney(entry.amountCents)}
                </ThemedText>
              ) : null}
            </View>
          ))}
          {filtered.length > PAGE ? (
            <Button
              label={showAll ? 'Show fewer' : `Show all ${filtered.length}`}
              variant="quiet"
              onPress={() => setShowAll((current) => !current)}
            />
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}
