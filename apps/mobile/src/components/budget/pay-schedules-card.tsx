import { router } from 'expo-router';
import { View } from 'react-native';
import { formatCentsCompact } from '@own-my-budget/core';

import { BudgetCard } from '@/components/budget/budget-card';
import { formatPayday } from '@/components/budget/format';
import { FREQUENCY_LABEL, type PaySchedule } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface PaySchedulesCardProps {
  schedules: PaySchedule[];
  isLoading: boolean;
}

/** The "Pay schedules" list: who pays how much, how often, and when next — plus Add / Edit. */
export function PaySchedulesCard({ schedules, isLoading }: PaySchedulesCardProps) {
  const theme = useTheme();

  return (
    <BudgetCard
      title="Pay schedules"
      action={
        <Button
          label="+ Add income source"
          size="sm"
          shape="rounded"
          onPress={() => router.push('/add-income')}
        />
      }
    >
      {schedules.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          {isLoading
            ? 'Loading your pay schedules…'
            : 'No pay schedules yet. Add where your money comes from and how often you get paid — your paydays will appear below.'}
        </ThemedText>
      ) : (
        <View>
          {schedules.map((schedule, index) => {
            const next = schedule.upcomingPayDate ?? schedule.nextPayDate;
            const caption = [
              FREQUENCY_LABEL[schedule.frequency] ?? schedule.frequency,
              !schedule.isActive
                ? 'paused'
                : next
                  ? `next ${formatPayday(next)}`
                  : 'add a first payday',
            ].join(' · ');
            return (
              <View
                key={schedule.id}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: Space[3],
                  paddingVertical: Space[3],
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                  opacity: schedule.isActive ? 1 : 0.7,
                }}
              >
                <View style={{ flexShrink: 1, flexBasis: 200, flexGrow: 1, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: Space[2],
                      alignItems: 'center',
                    }}
                  >
                    <ThemedText type="smallBold">{schedule.label}</ThemedText>
                    {!schedule.isActive ? <StatusPill label="Paused" tone="neutral" /> : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {caption}
                  </ThemedText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[3] }}>
                  <ThemedText type="amountSmall">
                    {formatCentsCompact(schedule.amountCents)}
                  </ThemedText>
                  <Button
                    label="Edit"
                    variant="soft"
                    size="sm"
                    shape="rounded"
                    accessibilityLabel={`Edit ${schedule.label}, ${formatCentsCompact(schedule.amountCents)}`}
                    onPress={() =>
                      router.push({ pathname: '/add-income', params: { id: schedule.id } })
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </BudgetCard>
  );
}
