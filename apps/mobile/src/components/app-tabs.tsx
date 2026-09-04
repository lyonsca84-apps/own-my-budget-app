import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { NAV_ITEMS } from '@/constants/nav';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : (scheme ?? 'light')];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
    >
      {NAV_ITEMS.map((item) => (
        <NativeTabs.Trigger key={item.name} name={item.name}>
          <NativeTabs.Trigger.Label>{item.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: item.sfSymbol, selected: item.sfSymbolFilled }} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
