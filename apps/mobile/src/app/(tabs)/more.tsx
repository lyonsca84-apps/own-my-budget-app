import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Layout, Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MORE_LINKS: {
  label: string;
  description: string;
  href: '/grocery-list' | '/reports' | '/profile' | '/settings';
  glyph: string;
  glyphColor: ThemeColor;
  glyphTint: ThemeColor;
}[] = [
  {
    label: 'Grocery & Receipts',
    description: 'Scan receipts, keep a grocery list, and get pantry-based suggestions.',
    href: '/grocery-list',
    glyph: '▤',
    glyphColor: 'accent',
    glyphTint: 'accentMuted',
  },
  {
    label: 'Reports',
    description: 'Spending by category, income vs. expenses, and debt & savings progress.',
    href: '/reports',
    glyph: '≡',
    glyphColor: 'primary',
    glyphTint: 'primaryMuted',
  },
  {
    label: 'Profile',
    description: 'Your name, sign-in email and sign-in methods.',
    href: '/profile',
    glyph: '◉',
    glyphColor: 'text',
    glyphTint: 'backgroundSelected',
  },
  {
    label: 'Settings',
    description: 'Plan & billing, reminders, privacy, security, help and the guided tour.',
    href: '/settings',
    glyph: '⚙',
    glyphColor: 'text',
    glyphTint: 'backgroundSelected',
  },
];

/**
 * Mobile-only landing spot for sections that get their own top-level sidebar
 * item on wide/web layouts (see WIDE_EXTRA_LINKS in constants/nav.ts) but
 * don't fit as a 6th/7th bottom tab on a phone.
 */
export default function MoreScreen() {
  const theme = useTheme();

  return (
    <Screen showGuestBanner>
      <ScreenHeader title="More" subtitle="Groceries, reports, your profile and settings." />
      <View style={{ gap: Space[3] }}>
        {MORE_LINKS.map((link) => (
          <Pressable
            key={link.href}
            accessibilityRole="button"
            accessibilityLabel={`${link.label}. ${link.description}`}
            onPress={() => router.push(link.href)}
            style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
          >
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Space[4],
                minHeight: Layout.minimumTouchTarget,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: Radius.input,
                  backgroundColor: theme[link.glyphTint],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ThemedText themeColor={link.glyphColor} style={{ fontSize: 20 }}>
                  {link.glyph}
                </ThemedText>
              </View>
              <View style={{ flex: 1, gap: Space[1] }}>
                <ThemedText type="smallBold">{link.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {link.description}
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
