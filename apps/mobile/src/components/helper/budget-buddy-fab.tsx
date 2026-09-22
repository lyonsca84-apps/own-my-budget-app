import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Space } from '@/constants/theme';

export interface BudgetBuddyFabProps {
  onPress: () => void;
  /** Distance from the bottom of the positioned parent. */
  bottom?: number;
  /** True while the chat panel this button controls is open. */
  expanded?: boolean;
}

const SHADOW = Platform.select({
  web: { boxShadow: '0 10px 24px rgba(0,18,40,.22)' },
  default: {
    shadowColor: Brand.panel,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

/**
 * The persistent Budget Buddy launcher from the approved design: a 56px
 * Electricity-to-Sky circle with a ✦ mark. The mark is white, matching
 * the approved design.
 */
export function BudgetBuddyFab({ onPress, bottom = Space[4], expanded }: BudgetBuddyFabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Close Budget Buddy' : 'Open Budget Buddy, your AI assistant'}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: Space[4],
          bottom,
          width: 56,
          height: 56,
          borderRadius: 28,
          overflow: 'hidden',
          opacity: pressed ? 0.88 : 1,
          zIndex: 40,
        },
        SHADOW,
      ]}
    >
      <LinearGradient
        colors={[Brand.electricity, Brand.sky]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <ThemedText style={{ color: '#FFFFFF', fontSize: 26, lineHeight: 30 }}>✦</ThemedText>
      </LinearGradient>
    </Pressable>
  );
}
