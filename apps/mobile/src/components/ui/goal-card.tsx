import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { CurrencyText } from '@/components/ui/currency-text';
import { ProgressRing } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface GoalCardProps {
  title: string;
  description?: string;
  savedCents: number;
  targetCents: number;
  percent: number;
  isComplete: boolean;
  targetDate?: string | null;
  /** A `require()`'d asset from `@/design-system/assets/goals`. */
  illustration?: number;
  /** Buttons — "View details" then "Add deposit", per the handoff's fixed action order. */
  actions: ReactNode;
}

/** The savings-goal card: optional artwork, a progress ring carrying the percentage, then saved/target and actions. */
export function GoalCard({
  title,
  description,
  savedCents,
  targetCents,
  percent,
  isComplete,
  targetDate,
  illustration,
  actions,
}: GoalCardProps) {
  const theme = useTheme();

  return (
    <Card style={{ gap: Space[4] }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: Space[3],
        }}
      >
        {illustration ? (
          <Image source={illustration} style={{ width: 96, height: 96 }} contentFit="contain" />
        ) : (
          <View style={{ flex: 1 }}>
            <GoalHeading title={title} description={description} />
          </View>
        )}
        <ProgressRing percent={percent} color={isComplete ? theme.successSolid : undefined} />
      </View>

      {illustration ? <GoalHeading title={title} description={description} /> : null}

      <View style={{ height: 1, backgroundColor: theme.border }} />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: Space[3],
        }}
      >
        <View>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Saved / target
          </ThemedText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: Space[1],
              marginTop: Space[1],
            }}
          >
            <CurrencyText cents={savedCents} size="amount" />
            <ThemedText themeColor="textSecondary">/ {formatWholeTarget(targetCents)}</ThemedText>
          </View>
          {targetDate && !isComplete ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Space[1] }}>
              Target date: {targetDate}
            </ThemedText>
          ) : null}
        </View>
        {isComplete ? <StatusPill label="Reached!" tone="success" /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: Space[2] }}>{actions}</View>
    </Card>
  );
}

function GoalHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View>
      <ThemedText type="subtitle">{title}</ThemedText>
      {description ? (
        <ThemedText themeColor="textSecondary" style={{ marginTop: Space[1] }}>
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

function formatWholeTarget(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
