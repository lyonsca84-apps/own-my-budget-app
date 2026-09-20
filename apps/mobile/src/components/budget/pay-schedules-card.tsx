import { router } from 'expo-router';
import { View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { formatPayday } from '@/components/budget/format';
import { FREQUENCY_LABEL, type PaySchedule } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CurrencyText } from '@/components/ui/currency-text';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { useTheme } from '@/hooks/use-theme';
import { Space } from '@/constants/theme';

export interface PaySchedulesCardProps {
  schedules: PaySchedule[];
  editable: boolean;
  isLoading: boolean;
}

/** The "Pay schedules" list: who pays how much, how often, and when next. */
export function PaySchedulesCard({ schedules, editable, isLoading }: PaySchedulesCardProps) {
  const theme = useTheme();

  return (
    <SectionCard
      title="Pay schedules"
      action={
        editable ? (
          <Button
            label="+ Add income source"
            variant="secondary"
            onPress={() => router.push('/add-income')}
          />
        ) : undefined
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
                  <CurrencyText cents={schedule.amountCents} size="row" />
                  {editable ? (
                    <Button
                      label="Edit"
                      variant="secondary"
                      accessibilityLabel={`Edit ${schedule.label}, ${formatCents(schedule.amountCents)}`}
                      onPress={() =>
                        router.push({ pathname: '/add-income', params: { id: schedule.id } })
                      }
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
}
