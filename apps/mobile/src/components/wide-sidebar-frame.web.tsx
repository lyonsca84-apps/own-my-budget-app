import type { PropsWithChildren } from 'react';
import { router, Stack, usePathname, type Href } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';

import { NavButton, NavListChrome, SIDEBAR_BREAKPOINT } from '@/components/app-tabs.web';
import { BudgetBuddyFab } from '@/components/helper/budget-buddy-fab';
import { NAV_ITEMS, WIDE_EXTRA_LINKS } from '@/constants/nav';

function goToTab(href: Href) {
  if (href === '/') {
    // '/' is also the sign-in screen's path (the (auth) group), so a plain
    // navigate('/') only closes this modal and lands on whichever tab was
    // open before. Naming the tab explicitly switches to the Dashboard.
    router.navigate({ pathname: '/(tabs)', params: { screen: 'index' } });
    return;
  }
  // The tab shell already sits beneath this modal; navigate pops back down
  // to it rather than stacking another copy on top.
  router.navigate(href);
}

/**
 * Grocery and Reports are root-level modal screens on every platform (the
 * native tab bar can't host extra routes), so on their own they open with a
 * modal header and no sidebar. On wide web this frame draws the same sidebar
 * beside them, matching the approved design where they are sidebar sections.
 * Narrower web layouts and native keep the plain modal presentation.
 */
export function WideSidebarFrame({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();

  if (width < SIDEBAR_BREAKPOINT) return <>{children}</>;

  const openHelper = () => router.push('/helper');

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <NavListChrome isWide onOpenHelper={openHelper}>
        {NAV_ITEMS.filter((item) => !item.hideOnWide).map((item) => (
          <NavButton
            key={item.name}
            label={item.wideLabel}
            isWide
            isFocused={false}
            onPress={() => goToTab(item.href)}
          />
        ))}
        {WIDE_EXTRA_LINKS.map((link) => (
          <NavButton
            key={link.href as string}
            label={link.label}
            isWide
            isFocused={pathname === link.href}
            onPress={() => router.replace(link.href)}
          />
        ))}
      </NavListChrome>
      <View style={{ flex: 1, minHeight: 0 }}>
        {children}
        <BudgetBuddyFab onPress={openHelper} />
      </View>
    </View>
  );
}
