import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { View } from 'react-native';

import { BudgetBuddyFab } from '@/components/helper/budget-buddy-fab';
import { NAV_ITEMS } from '@/constants/nav';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];

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
          standard tab on any platform. Sits above the native tab bar. */}
      <BudgetBuddyFab bottom={90} onPress={() => router.push('/helper')} />
    </View>
  );
}
