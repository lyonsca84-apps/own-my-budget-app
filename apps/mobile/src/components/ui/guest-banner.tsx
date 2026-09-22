import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Colors, Space } from '@/constants/theme';

/**
 * Persistent Panel-navy strip with an Ecology-green call to action — shown above the
 * scroll area (so it never scrolls away) on screens that show guest sample
 * data. Matches the approved design: navy bar, green "Create free account →" link (Ecology reads AA on Panel). Deliberately
 * fixed (not theme-aware): Panel is the ink color in light mode and the
 * background in dark mode, so this banner keeps its own hardcoded light
 * text rather than following `useTheme()`.
 */
export function GuestBanner() {
  return (
    <View
      style={{
        backgroundColor: Brand.panel,
        paddingVertical: Space[2] + 2,
        paddingHorizontal: Space[7],
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Space[3],
      }}
    >
      <ThemedText
        type="small"
        style={{
          color: Colors.light.onPanel,
          opacity: 0.9,
          flexShrink: 1,
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        You&rsquo;re exploring{' '}
        <ThemedText
          type="smallBold"
          style={{ color: Colors.light.onPanel, fontSize: 14, lineHeight: 20 }}
        >
          Own My Budget
        </ThemedText>{' '}
        in Guest Mode — everything here is sample data, safe to click around.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a free account"
        onPress={() => router.push('/sign-up')}
        hitSlop={8}
      >
        <ThemedText type="smallBold" style={{ color: Brand.ecology, fontSize: 14, lineHeight: 20 }}>
          Create free account →
        </ThemedText>
      </Pressable>
    </View>
  );
}
