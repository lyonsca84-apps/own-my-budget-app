import { Pressable, View } from 'react-native';

import { Brand, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The goal / card accent colors from the design's "Add savings goal" dialog. */
export const GOAL_SWATCHES: string[] = [
  Brand.electricity,
  '#4A96EA',
  Brand.panel,
  Brand.ecology,
  '#DCE45E',
];

export interface SwatchPickerProps {
  /** Hex colors to choose from. */
  colors: readonly string[];
  value: string | null | undefined;
  onChange: (color: string) => void;
  /** Group label read by screen readers, e.g. "Goal color". */
  label: string;
  /** Circle diameter, default 32. */
  size?: number;
  /** Optional names for screen readers, same order as `colors` (defaults to the hex). */
  names?: readonly string[];
}

/** A row of selectable color circles. The selected one gets a Panel-navy ring. */
export function SwatchPicker({
  colors,
  value,
  onChange,
  label,
  size = 32,
  names,
}: SwatchPickerProps) {
  const theme = useTheme();
  const ring = 3;
  const outer = size + ring * 2 + 2;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}
    >
      {colors.map((color, index) => {
        const selected = value?.toLowerCase() === color.toLowerCase();
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityLabel={names?.[index] ?? color}
            aria-checked={selected}
            onPress={() => onChange(color)}
            hitSlop={4}
            style={{
              width: outer,
              height: outer,
              borderRadius: outer / 2,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: ring,
              borderColor: selected ? theme.panel : 'transparent',
            }}
          >
            <View
              style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
