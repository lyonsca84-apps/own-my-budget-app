import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { formatShortDate } from '@/components/savings/format';
import type { GoalActivityView } from '@/components/savings/use-savings-data';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'all' | 'deposits' | 'withdrawals' | 'challenges';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'challenges', label: 'Challenges' },
];

const PAGE = 8;

function typeLabel(entry: GoalActivityView) {
  if (entry.kind === 'withdrawal') return 'Withdrawal';
  return entry.isChallenge ? 'Challenge deposit' : 'Deposit';
}

/** Recent Savings Activity: every deposit/withdrawal across goals, filterable, newest first. */
export function ActivitySection({ activity }: { activity: GoalActivityView[] }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);

  const filtered = activity.filter((entry) => {
    if (filter === 'deposits') return entry.kind === 'deposit';
    if (filter === 'withdrawals') return entry.kind === 'withdrawal';
    if (filter === 'challenges') return entry.isChallenge;
    return true;
  });
  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  return (
    <SectionCard title="Recent Savings Activity">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setShowAll(false);
          }}
        />
      </ScrollView>
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
                flexWrap: 'wrap',
                gap: Space[2],
                paddingVertical: Space[3],
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.border,
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <ThemedText type="smallBold">{entry.goalTitle}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {typeLabel(entry)} · {formatShortDate(entry.occurredOn)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </ThemedText>
              </View>
              <ThemedText
                type="amountSmall"
                themeColor={entry.kind === 'withdrawal' ? 'textSecondary' : 'text'}
              >
                {entry.kind === 'withdrawal' ? '−' : '+'}
                {formatCents(entry.amountCents)}
              </ThemedText>
            </View>
          ))}
          {!showAll && filtered.length > PAGE ? (
            <Button
              label={`Show all ${filtered.length}`}
              variant="quiet"
              onPress={() => setShowAll(true)}
            />
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}
