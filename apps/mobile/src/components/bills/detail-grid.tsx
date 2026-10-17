import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ResponsiveGrid } from './common';

export interface DetailItemProps {
  label: string;
  /** null/empty renders an "Add information" link when onAdd is given, otherwise an em dash. */
  value: string | null | undefined;
  onAdd?: () => void;
  /** Adds a word next to the value (never color alone) — e.g. "watch" for high utilization. */
  tone?: 'default' | 'watch';
}

export function DetailItem({ label, value, onAdd, tone = 'default' }: DetailItemProps) {
  const missing = value === null || value === undefined || value === '';
  return (
    <View style={{ gap: 2, minWidth: 0 }}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {missing && onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${label.toLowerCase()}`}
          onPress={onAdd}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ alignSelf: 'flex-start' }}
        >
          <ThemedText type="smallBold" themeColor="solidAccent">
            Add information
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="smallBold" themeColor={tone === 'watch' ? 'warning' : 'text'}>
          {missing ? '—' : value}
        </ThemedText>
      )}
    </View>
  );
}

/** A wrapping grid of label/value facts — a card's or loan's details. */
export function DetailGrid({
  children,
  maxColumns = 5,
  minCell = 150,
}: {
  children: ReactNode;
  maxColumns?: number;
  minCell?: number;
}) {
  return (
    <ResponsiveGrid minCell={minCell} maxColumns={maxColumns} gap={Space[4]} align="flex-start">
      {Children.toArray(children)}
    </ResponsiveGrid>
  );
}

/** The design's summary tiles: three solid (navy / blue / green), one soft teal, the rest plain. */
export type TileTone = 'panel' | 'primary' | 'success' | 'accent' | 'plain';

const TILE_COLORS: Record<TileTone, { bg: ThemeColor | null; fg: ThemeColor }> = {
  panel: { bg: 'panel', fg: 'onPanel' },
  primary: { bg: 'solidInfo', fg: 'onSolid' },
  success: { bg: 'solidSuccess', fg: 'onSolid' },
  accent: { bg: 'accentMuted', fg: 'text' },
  plain: { bg: null, fg: 'text' },
};

export function SummaryTile({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string;
  tone?: TileTone;
}) {
  const theme = useTheme();
  const colors = TILE_COLORS[tone];
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        gap: Space[1],
        padding: Space[4],
        borderRadius: Radius.smallCard,
        backgroundColor: colors.bg ? theme[colors.bg] : 'transparent',
      }}
    >
      <ThemedText type="small" themeColor={colors.fg} style={{ fontFamily: Fonts.body.medium }}>
        {label}
      </ThemedText>
      <ThemedText
        themeColor={colors.fg}
        style={{
          fontFamily: Fonts.heading.bold,
          fontSize: 24,
          lineHeight: 30,
          letterSpacing: -0.24,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </ThemedText>
    </View>
  );
}

/** Up to five tiles a row on wide screens, two on a phone. */
export function SummaryTiles({ children }: { children: ReactNode }) {
  return (
    <ResponsiveGrid minCell={170} maxColumns={5} gap={Space[3]}>
      {Children.toArray(children)}
    </ResponsiveGrid>
  );
}
