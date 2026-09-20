import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CountTileProps {
  label: string;
  /** Pre-formatted value — a count, "3 Badges", a signed amount. */
  value: string;
  description?: string;
  glyph?: string;
  glyphColor?: ThemeColor;
  glyphTint?: ThemeColor;
  /** Optional color for the value/description (e.g. success for growth). Always paired with text. */
  valueColor?: ThemeColor;
}

/** StatTile's twin for non-currency figures (badge counts, signed monthly growth) — same anatomy, string value. */
export function CountTile({
  label,
  value,
  description,
  glyph,
  glyphColor = 'primary',
  glyphTint = 'primaryMuted',
  valueColor,
}: CountTileProps) {
  const theme = useTheme();

  return (
    <Card style={{ flexGrow: 1, flexBasis: 220, gap: Space[3] }}>
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
      <ThemedText type="amount" themeColor={valueColor}>
        {value}
      </ThemedText>
      {description ? (
        <ThemedText type="small" themeColor={valueColor ?? 'textSecondary'}>
          {description}
        </ThemedText>
      ) : null}
    </Card>
  );
}
