import { View } from 'react-native';
import { formatCents, type AllocationSegment } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useChartColors } from './chart-colors';

export interface AllocationChartProps {
  segments: AllocationSegment[];
  /** Spoken summary prefix, e.g. "Where September's income went". */
  accessibilityTitle: string;
}

/**
 * A single stacked bar plus a legend that repeats every category's name,
 * amount and share — so the chart is readable without color. Segments keep
 * the design system's fixed order (Bills, Debt, Groceries, Savings,
 * Available) and are separated by a gap in the card color.
 */
export function AllocationChart({ segments, accessibilityTitle }: AllocationChartProps) {
  const theme = useTheme();
  const colors = useChartColors();
  const visible = segments.filter((s) => s.cents > 0);
  const summary = segments
    .map((s) => `${s.label} ${formatCents(s.cents)}, ${Math.round(s.percent)} percent`)
    .join('; ');

  return (
    <View style={{ gap: Space[4] }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${accessibilityTitle}. ${summary}`}
        style={{
          flexDirection: 'row',
          height: 20,
          borderRadius: Radius.full,
          overflow: 'hidden',
          backgroundColor: theme.backgroundSelected,
          gap: 2,
        }}
      >
        {visible.map((segment) => (
          <View
            key={segment.key}
            style={{
              flexGrow: segment.percent,
              flexBasis: 0,
              backgroundColor: colors[segment.key],
            }}
          />
        ))}
      </View>

      <View style={{ gap: Space[1] }}>
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Space[3],
              minHeight: 36,
            }}
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                backgroundColor: colors[segment.key],
                borderWidth: 1,
                borderColor: theme.controlBorder,
              }}
            />
            <ThemedText type="smallBold" style={{ flex: 1 }}>
              {segment.label}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={{ minWidth: 44, textAlign: 'right' }}
            >
              {Math.round(segment.percent)}%
            </ThemedText>
            <ThemedText type="amountSmall" style={{ minWidth: 96, textAlign: 'right' }}>
              {formatCents(segment.cents)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}
