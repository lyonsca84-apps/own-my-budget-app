import { View } from 'react-native';

/** Small down (or up) chevron drawn with borders, so it renders identically everywhere without an icon font. */
export function Chevron({
  color,
  size = 8,
  up = false,
}: {
  color: string;
  size?: number;
  up?: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: up ? '-135deg' : '45deg' }, { translateY: up ? -1 : -2 }],
      }}
    />
  );
}
