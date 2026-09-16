import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Space } from '@/constants/theme';

const MORE_LINKS: { label: string; description: string; href: '/grocery-list' | '/reports' }[] = [
  {
    label: 'Grocery',
    description: 'Track your grocery list and scan receipts or your pantry.',
    href: '/grocery-list',
  },
  {
    label: 'Reports',
    description: 'See spending, income vs. expenses, and debt & savings trends.',
    href: '/reports',
  },
];

/**
 * Mobile-only landing spot for sections that get their own top-level sidebar
 * item on wide/web layouts (see WIDE_EXTRA_LINKS in constants/nav.ts) but
 * don't fit as a 6th/7th bottom tab on a phone.
 */
export default function MoreScreen() {
  return (
    <Screen>
      <ScreenHeader title="More" />
      <View style={{ gap: Space[3] }}>
        {MORE_LINKS.map((link) => (
          <Pressable
            key={link.href}
            accessibilityRole="button"
            accessibilityLabel={link.label}
            onPress={() => router.push(link.href)}
          >
            <Card style={{ gap: Space[1] }}>
              <ThemedText type="smallBold">{link.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {link.description}
              </ThemedText>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
