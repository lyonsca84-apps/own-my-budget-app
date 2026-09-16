import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Pressable, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NAV_ITEMS } from '@/constants/nav';
import { Colors, Spacing } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : (scheme ?? 'light')];

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.backgroundElement}
        labelStyle={{ selected: { color: colors.text } }}
      >
        {NAV_ITEMS.map((item) => (
          <NativeTabs.Trigger key={item.name} name={item.name}>
            <NativeTabs.Trigger.Label>{item.narrowLabel}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: item.sfSymbol, selected: item.sfSymbolFilled }}
            />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>

      {/* Persistent AI Helper access, matching the approved design — not a
          standard tab on any platform. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Budget Buddy, your AI assistant"
        onPress={() => router.push('/helper')}
        style={{
          position: 'absolute',
          right: Spacing.four,
          bottom: 90,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.budgetBuddy,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <ThemedText style={{ color: colors.onPrimary, fontSize: 22 }}>✦</ThemedText>
      </Pressable>
    </View>
  );
}
