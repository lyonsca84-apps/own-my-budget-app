import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';

/**
 * Top-level (reachable from any tab via the header avatar), not one of the
 * 5 primary tabs — matches PLAN.md's "Settings lives behind the avatar in
 * the header." Full settings (notification preferences, data export,
 * account deletion) are Phase 7; this is just enough for the account
 * lifecycle Phase 3 owns.
 */
export default function SettingsScreen() {
  const { status, user, signOut, exitGuestMode } = useAuth();
  const isGuest = status === 'guest';

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: Spacing.four, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Settings
          </ThemedText>

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ACCOUNT
            </ThemedText>
            <ThemedText>{isGuest ? 'Guest — demo data only' : (user?.email ?? '')}</ThemedText>
          </Card>

          {isGuest ? (
            <Button
              label="Create an account"
              onPress={() => {
                exitGuestMode();
                router.replace('/sign-up');
              }}
            />
          ) : (
            <Button label="Log out" variant="secondary" onPress={() => signOut()} />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
