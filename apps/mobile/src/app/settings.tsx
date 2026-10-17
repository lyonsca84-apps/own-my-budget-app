import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/auth-context';
import { useTour } from '@/contexts/tour-context';
import { Space } from '@/constants/theme';

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
  const tour = useTour();

  return (
    <Screen>
      <SectionCard title="Account">
        <ThemedText>{isGuest ? 'Guest — demo data only' : (user?.email ?? '')}</ThemedText>
      </SectionCard>

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
          <SectionCard title="General">
            <View style={{ gap: Space[3] }}>
              <Button
                label="Subscription & plan"
                variant="secondary"
                onPress={() => router.push('/subscription')}
              />
              <Button label="Reports" variant="secondary" onPress={() => router.push('/reports')} />
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
              <Button
                label="Take the tour again"
                variant="secondary"
                accessibilityLabel="Take Budget Buddy's guided tour again. Your saved budget stays as it is."
                onPress={() => tour.start({ replay: true })}
              />
            </View>
          </SectionCard>
          <Button label="Log out" variant="quiet" onPress={() => signOut()} />
        </>
      )}
    </Screen>
  );
}
