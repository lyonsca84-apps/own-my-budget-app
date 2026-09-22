import { formatCents, type ChangeNote } from '@own-my-budget/core';
import { View } from 'react-native';

import { Caption } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SummaryCardData {
  label: string;
  cents: number;
  glyph: string;
  glyphColor: ThemeColor;
  glyphTint: ThemeColor;
  /** Month-over-month line, or a plain caption like "2 of 6 bills paid". */
  note: ChangeNote | { text: string; tone: 'neutral' };
  help: string;
}

const NOTE_COLOR: Record<ChangeNote['tone'], ThemeColor> = {
  good: 'success',
  watch: 'warning',
  neutral: 'textSecondary',
};

/** The four headline figures: Total Income, Bills and Payments, Savings, Money Available. */
export function SummaryCards({ cards }: { cards: SummaryCardData[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] }}>
      {cards.map((card) => (
        <Card
          key={card.label}
          style={{ flexGrow: 1, flexBasis: 200, minWidth: 0, padding: 20, gap: Space[2] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            <View
              accessibilityElementsHidden
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: theme[card.glyphTint],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ThemedText themeColor={card.glyphColor} style={{ fontSize: 15, lineHeight: 20 }}>
                {card.glyph}
              </ThemedText>
            </View>
            <Caption bold style={{ flexShrink: 1 }}>
              {card.label}
            </Caption>
          </View>
          <ThemedText
            style={{
              fontFamily: Fonts.heading.bold,
              fontSize: 26,
              lineHeight: 34,
              letterSpacing: -0.26,
              fontVariant: ['tabular-nums'],
            }}
            accessibilityLabel={`${card.label}: ${formatCents(card.cents)}`}
          >
            {formatCents(card.cents)}
          </ThemedText>
          <Caption bold color={NOTE_COLOR[card.note.tone]}>
            {card.note.text}
          </Caption>
          <Caption style={{ fontSize: 13, lineHeight: 19 }}>{card.help}</Caption>
        </Card>
      ))}
    </View>
  );
}
