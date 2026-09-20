import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface DetailItemProps {
  label: string;
  /** null/empty renders an em dash (and an "Add" link when onAdd is given) rather than repeated prose. */
  value: string | null | undefined;
  onAdd?: () => void;
}

export function DetailItem({ label, value, onAdd }: DetailItemProps) {
  const missing = value === null || value === undefined || value === '';
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, gap: 2 }}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2], flexWrap: 'wrap' }}>
        <ThemedText type="smallBold">{missing ? '—' : value}</ThemedText>
        {missing && onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${label.toLowerCase()}`}
            onPress={onAdd}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ThemedText type="smallBold" themeColor="primary">
              Add
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A wrapping grid of label/value facts — used for a card's or loan's "more details". */
export function DetailGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] }}>{children}</View>;
}

export type TileTone = 'panel' | 'primary' | 'success' | 'accent' | 'muted';

const TILE_COLORS: Record<TileTone, { bg: ThemeColor; fg: ThemeColor }> = {
  panel: { bg: 'panel', fg: 'onPanel' },
  primary: { bg: 'primary', fg: 'onPrimary' },
  success: { bg: 'successMuted', fg: 'success' },
  accent: { bg: 'accentMuted', fg: 'text' },
  muted: { bg: 'backgroundElement', fg: 'text' },
};

/** The design's colored summary tile: small label over a Poppins figure. */
export function SummaryTile({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: TileTone;
}) {
  const theme = useTheme();
  const colors = TILE_COLORS[tone];
  return (
    <Card
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexGrow: 1,
        flexBasis: 160,
        gap: Space[1],
        padding: Space[4],
        borderRadius: Radius.smallCard,
        backgroundColor: theme[colors.bg],
      }}
    >
      <ThemedText type="smallBold" themeColor={colors.fg}>
        {label}
      </ThemedText>
      <ThemedText type="amountSmall" themeColor={colors.fg}>
        {value}
      </ThemedText>
    </Card>
  );
}

export function SummaryTiles({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>{children}</View>;
}
