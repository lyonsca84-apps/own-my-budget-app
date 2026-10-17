import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface FilterChipsProps {
  /** Label for the "no filter" chip. */
  allLabel: string;
  options: string[];
  /** The selected option, or null when "all" is selected. */
  value: string | null;
  onChange: (value: string | null) => void;
  accessibilityLabel: string;
}

/** A wrapping row of single-select chips — the design's category filter, with 44px targets. */
export function FilterChips({
  allLabel,
  options,
  value,
  onChange,
  accessibilityLabel,
}: FilterChipsProps) {
  const theme = useTheme();
  const all: (string | null)[] = [null, ...options];

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}
    >
      {all.map((option) => {
        const selected = option === value;
        const label = option ?? allLabel;
        return (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            onPress={() => onChange(option)}
            style={{
              minHeight: Layout.minimumTouchTarget,
              paddingHorizontal: Space[4],
              borderRadius: Radius.full,
              justifyContent: 'center',
              backgroundColor: selected ? theme.panel : theme.backgroundSelected,
            }}
          >
            <ThemedText type="smallBold" themeColor={selected ? 'onPanel' : 'textSecondary'}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
