import type { SnapshotCard, SnapshotTone } from '@own-my-budget/core';
import { View } from 'react-native';

import { Caption } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BADGE_COLORS: Record<SnapshotTone, { fg: ThemeColor; bg: ThemeColor }> = {
  success: { fg: 'success', bg: 'successMuted' },
  warning: { fg: 'warning', bg: 'warningMuted' },
  danger: { fg: 'clay', bg: 'clayMuted' },
  accent: { fg: 'solidAccent', bg: 'accentMuted' },
};

/** A compact status badge that fits the narrow snapshot cards. */
function Badge({ label, tone }: { label: string; tone: SnapshotTone }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${label}`}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme[BADGE_COLORS[tone].bg],
        borderRadius: Radius.chip,
        paddingVertical: 3,
        paddingHorizontal: 8,
      }}
    >
      <ThemedText
        style={{
          color: theme[BADGE_COLORS[tone].fg],
          fontFamily: Fonts.body.bold,
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

/** Six compact snapshot cards, each with a status badge (text says it; color only backs it up). */
export function SnapshotGrid({ cards }: { cards: SnapshotCard[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
      {cards.map((card) => (
        <Card
          key={card.key}
          style={{
            flexGrow: 1,
            flexBasis: 136,
            minWidth: 0,
            padding: 16,
            gap: Space[2],
            borderRadius: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              columnGap: Space[2],
              rowGap: Space[1],
            }}
          >
            <Caption bold style={{ fontSize: 13, lineHeight: 18, flexShrink: 1 }}>
              {card.title}
            </Caption>
            <Badge label={card.badge} tone={card.tone} />
          </View>
          <ThemedText
            style={{
              fontFamily: Fonts.heading.bold,
              fontSize: 22,
              lineHeight: 30,
              fontVariant: ['tabular-nums'],
            }}
          >
            {card.value}
          </ThemedText>
          <View style={{ gap: 2 }}>
            {card.lines.map((line) => (
              <Caption key={line} style={{ fontSize: 13, lineHeight: 18 }}>
                {line}
              </Caption>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}
