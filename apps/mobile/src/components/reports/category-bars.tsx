import { Pressable, View } from 'react-native';
import { formatCents, type EntryCategoryTotal } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useKindColor } from './chart-colors';

export interface CategoryBarsProps {
  totals: EntryCategoryTotal[];
  /** The category currently filtered to (case-insensitive), or null for all. */
  selected?: string | null;
  /** Called with the category name, or null to clear when the selected row is tapped again. */
  onSelect?: (categoryName: string | null) => void;
}

/**
 * The design's "category — actual — bar" rows. Each row states its name,
 * amount, share and payment count in text; the bar is a redundant visual.
 * When `onSelect` is given the row doubles as a filter toggle.
 */
export function CategoryBars({ totals, selected, onSelect }: CategoryBarsProps) {
  const theme = useTheme();
  const kindColor = useKindColor();
  const grandTotal = totals.reduce((sum, t) => sum + t.totalCents, 0);
  const maxTotal = Math.max(...totals.map((t) => t.totalCents), 1);
  const selectedKey = selected?.trim().toLowerCase() ?? null;

  return (
    <View style={{ gap: Space[1] }}>
      {totals.map((total) => {
        const isSelected = selectedKey === total.categoryName.toLowerCase();
        const share = grandTotal > 0 ? Math.round((total.totalCents / grandTotal) * 100) : 0;
        const countLabel = `${total.count} payment${total.count === 1 ? '' : 's'}`;
        const Row = onSelect ? Pressable : View;
        return (
          <Row
            key={total.categoryName}
            {...(onSelect
              ? {
                  accessibilityRole: 'button' as const,
                  accessibilityLabel: `${total.categoryName}, ${formatCents(total.totalCents)}, ${share} percent of spending, ${countLabel}. ${isSelected ? 'Showing only this category. Tap to show all.' : 'Tap to show only this category.'}`,
                  accessibilityState: { selected: isSelected },
                  onPress: () => onSelect(isSelected ? null : total.categoryName),
                }
              : {})}
            style={{
              minHeight: Layout.minimumTouchTarget,
              gap: Space[2],
              paddingVertical: Space[2],
              paddingHorizontal: Space[2],
              borderRadius: Radius.input,
              backgroundColor: isSelected ? theme.backgroundSelected : 'transparent',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: Space[3],
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <ThemedText type="smallBold">{total.categoryName}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {countLabel} · {share}%
                </ThemedText>
              </View>
              <ThemedText type="amountSmall">{formatCents(total.totalCents)}</ThemedText>
            </View>
            <View
              style={{
                height: 10,
                borderRadius: Radius.full,
                backgroundColor: theme.backgroundSelected,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.max((total.totalCents / maxTotal) * 100, 2)}%`,
                  borderRadius: Radius.full,
                  backgroundColor: kindColor[total.kind],
                }}
              />
            </View>
          </Row>
        );
      })}
    </View>
  );
}
