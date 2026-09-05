import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
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
 * the header." Now the real navigation hub for everything Phase 7 added;
 * signed-in-only sections (notifications, categories, data & privacy,
 * security) hide in guest mode since they operate on real account data.
 */
export default function SettingsScreen() {
  const { status, user, signOut, exitGuestMode } = useAuth();
  const isGuest = status === 'guest';

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
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
            <>
              <View style={{ gap: Spacing.two }}>
                <Button
                  label="Subscription & plan"
                  variant="secondary"
                  onPress={() => router.push('/subscription')}
                />
                <Button
                  label="Reports"
                  variant="secondary"
                  onPress={() => router.push('/reports')}
                />
                <Button
                  label="Notifications"
                  variant="secondary"
                  onPress={() => router.push('/notification-settings')}
                />
                <Button
                  label="Manage categories"
                  variant="secondary"
                  onPress={() => router.push('/manage-categories')}
                />
                <Button
                  label="Security"
                  variant="secondary"
                  onPress={() => router.push('/security')}
                />
                <Button
                  label="Data & privacy"
                  variant="secondary"
                  onPress={() => router.push('/data-privacy')}
                />
                <Button
                  label="Help, FAQ & legal"
                  variant="secondary"
                  onPress={() => router.push('/help-legal')}
                />
              </View>
              <Button label="Log out" variant="secondary" onPress={() => signOut()} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
