import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** The pill-group toggle from the handoff's "Selection & toggles" section — e.g. Monthly/Yearly, date-range filters. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: theme.backgroundSelected,
        borderRadius: Radius.full,
        padding: 4,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              paddingVertical: Space[2],
              paddingHorizontal: Space[4],
              borderRadius: Radius.full,
              backgroundColor: selected ? theme.panel : 'transparent',
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText type="smallBold" themeColor={selected ? 'onPanel' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
