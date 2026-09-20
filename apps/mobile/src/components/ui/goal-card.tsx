import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { CurrencyText } from '@/components/ui/currency-text';
import { ProgressRing } from '@/components/ui/progress-bar';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface GoalCardProps {
  title: string;
  description?: string;
  /** Small category line under the title, e.g. "Emergency Fund". */
  category?: string;
  savedCents: number;
  targetCents: number;
  percent: number;
  isComplete: boolean;
  targetDate?: string | null;
  /** When given, shows "$X remaining" under the saved / target line. */
  remainingCents?: number;
  /** A text status (never color alone). Completed goals show "Reached!" when this is omitted. */
  status?: { label: string; tone: StatusTone };
  /** A `require()`'d asset from `@/design-system/assets/goals`. */
  illustration?: number;
  /** Buttons — "View details" then "Add deposit", per the handoff's fixed action order. */
  actions: ReactNode;
  /** When both are given the heading row becomes a disclosure toggle for `details`. */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  details?: ReactNode;
}

/** The savings-goal card: optional artwork, a progress ring carrying the percentage, then saved/target and actions. */
export function GoalCard({
  title,
  description,
  category,
  savedCents,
  targetCents,
  percent,
  isComplete,
  targetDate,
  remainingCents,
  status,
  illustration,
  actions,
  expanded,
  onToggleExpanded,
  details,
}: GoalCardProps) {
  const theme = useTheme();
  const isDisclosure = !!onToggleExpanded;

  const header = (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: Space[3],
      }}
    >
      {illustration ? (
        <Image
          source={illustration}
          style={{ width: 96, height: 96 }}
          contentFit="contain"
          accessibilityLabel=""
        />
      ) : (
        <View style={{ flex: 1, minWidth: 0 }}>
          <GoalHeading title={title} description={description} category={category} />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
        <ProgressRing percent={percent} color={isComplete ? theme.successSolid : undefined} />
        {isDisclosure ? (
          <View
            style={{
              minWidth: Layout.minimumTouchTarget,
              minHeight: Layout.minimumTouchTarget,
              borderRadius: Radius.full,
              borderWidth: 1.5,
              borderColor: theme.controlBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityElementsHidden>
              {expanded ? '▴' : '▾'}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <Card style={{ gap: Space[4], minWidth: 0 }}>
      {isDisclosure ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: !!expanded }}
          accessibilityLabel={`${title}, ${Math.round(percent)} percent saved. ${expanded ? 'Hide' : 'Show'} details`}
          onPress={onToggleExpanded}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}

      {illustration ? (
        <GoalHeading title={title} description={description} category={category} />
      ) : null}

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
              flexWrap: 'wrap',
              gap: Space[1],
              marginTop: Space[1],
            }}
          >
            <CurrencyText cents={savedCents} size="amount" />
            <ThemedText themeColor="textSecondary">/ {formatWholeTarget(targetCents)}</ThemedText>
          </View>
          {remainingCents !== undefined && !isComplete ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Space[1] }}>
              {formatWholeTarget(remainingCents)} remaining
            </ThemedText>
          ) : null}
          {targetDate && !isComplete ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Space[1] }}>
              Target date: {targetDate}
            </ThemedText>
          ) : null}
        </View>
        {status ? (
          <StatusPill label={status.label} tone={status.tone} />
        ) : isComplete ? (
          <StatusPill label="Reached!" tone="success" />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>{actions}</View>

      {isDisclosure && expanded ? <View style={{ gap: Space[3] }}>{details}</View> : null}
    </Card>
  );
}

function GoalHeading({
  title,
  description,
  category,
}: {
  title: string;
  description?: string;
  category?: string;
}) {
  return (
    <View>
      <ThemedText type="subtitle">{title}</ThemedText>
      {category ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: Space[1] }}>
          {category}
        </ThemedText>
      ) : null}
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
