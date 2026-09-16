import { View } from 'react-native';

import { CurrencyText } from '@/components/ui/currency-text';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StatTileTrend {
  label: string;
  /** 'positive' = success color, 'watch' = calm amber (never red), 'neutral' = caption gray. */
  tone: 'positive' | 'watch' | 'neutral';
}

export interface StatTileProps {
  label: string;
  valueCents: number;
  description?: string;
  trend?: StatTileTrend;
  /** Single glyph in a 12%-tint icon tile, matching the handoff's stat-tile anatomy (no icon font is used there either). */
  glyph?: string;
  glyphColor?: ThemeColor;
  glyphTint?: ThemeColor;
  /** The one hero stat per screen gets an Energy outline — never apply this to more than one tile. */
  emphasize?: boolean;
}

const TREND_COLOR: Record<StatTileTrend['tone'], ThemeColor> = {
  positive: 'success',
  watch: 'warning',
  neutral: 'textSecondary',
};

export function StatTile({
  label,
  valueCents,
  description,
  trend,
  glyph,
  glyphColor = 'primary',
  glyphTint = 'primaryMuted',
  emphasize,
}: StatTileProps) {
  const theme = useTheme();

  return (
    <Card
      style={{
        flexGrow: 1,
        flexBasis: 220,
        gap: Space[3],
        borderWidth: emphasize ? 2 : 0,
        borderColor: emphasize ? theme.energy : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[3] }}>
        {glyph ? (
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: Radius.input - 1,
              backgroundColor: theme[glyphTint],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText themeColor={glyphColor}>{glyph}</ThemedText>
          </View>
        ) : null}
        <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
          {label}
        </ThemedText>
      </View>
      <CurrencyText cents={valueCents} size="amount" />
      {trend ? (
        <ThemedText type="smallBold" themeColor={TREND_COLOR[trend.tone]}>
          {trend.label}
        </ThemedText>
      ) : null}
      {description ? (
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      ) : null}
    </Card>
  );
}
