import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface MonthStepperProps {
  /** 0-based month (0 = January). */
  month: number;
  year: number;
  onChange: (next: { month: number; year: number }) => void;
}

/**
 * Steps one calendar month at a time ("September 2026"), rolling the year
 * over in either direction — the design's month + year pickers as a single
 * control with 44px targets.
 */
export function MonthStepper({ month, year, onChange }: MonthStepperProps) {
  const theme = useTheme();

  function step(delta: -1 | 1) {
    const next = new Date(year, month + delta, 1);
    onChange({ month: next.getMonth(), year: next.getFullYear() });
  }

  const label = `${MONTH_NAMES[month]} ${year}`;
  const previous = new Date(year, month - 1, 1);
  const following = new Date(year, month + 1, 1);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: theme.backgroundSelected,
        borderRadius: Radius.full,
        padding: 2,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous month, ${MONTH_NAMES[previous.getMonth()]} ${previous.getFullYear()}`}
        onPress={() => step(-1)}
        style={{
          minWidth: Layout.minimumTouchTarget,
          minHeight: Layout.minimumTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ThemedText type="smallBold">‹</ThemedText>
      </Pressable>
      <ThemedText
        type="smallBold"
        accessibilityLiveRegion="polite"
        style={{ minWidth: 132, textAlign: 'center', paddingHorizontal: Space[1] }}
      >
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next month, ${MONTH_NAMES[following.getMonth()]} ${following.getFullYear()}`}
        onPress={() => step(1)}
        style={{
          minWidth: Layout.minimumTouchTarget,
          minHeight: Layout.minimumTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ThemedText type="smallBold">›</ThemedText>
      </Pressable>
    </View>
  );
}
