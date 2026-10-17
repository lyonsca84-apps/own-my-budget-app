import { router, type Href } from 'expo-router';
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

  const link = (label: string, href: Href, hint?: string) => (
    <Button
      label={label}
      variant="secondary"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={() => router.push(href)}
    />
  );

  return (
    <Screen>
      {isGuest ? (
        <>
          <SectionCard title="Account">
            <ThemedText>Guest — demo data only</ThemedText>
          </SectionCard>
          <Button
            label="Create an account"
            onPress={() => {
              exitGuestMode();
              router.replace('/sign-up');
            }}
          />
        </>
      ) : (
        <>
          <SectionCard title="Profile & account">
            <ThemedText>{user?.email ?? ''}</ThemedText>
            {link('View profile', '/profile', 'Your name, sign-in email and sign-in methods.')}
          </SectionCard>

          <SectionCard title="Subscription & billing">
            <ThemedText type="small" themeColor="textSecondary">
              Your plan, price, renewal date, and Stripe’s secure page to update payment or cancel.
            </ThemedText>
            {link('Subscription & billing', '/subscription')}
          </SectionCard>

          <SectionCard title="Notifications & reminders">
            {link('Bill reminders', '/notification-settings')}
          </SectionCard>

          <SectionCard title="Privacy & data">
            {link(
              'Data & privacy',
              '/data-privacy',
              'What we store, export your data, delete your account.'
            )}
          </SectionCard>

          <SectionCard title="Security & access">
            <View style={{ gap: Space[3] }}>
              {link('Password & security', '/security')}
              <Button label="Log out" variant="outline" onPress={() => signOut()} />
            </View>
          </SectionCard>

          <SectionCard title="Help & legal">
            {link(
              'Help, FAQ & legal',
              '/help-legal',
              'Help, the educational disclaimer, Privacy Policy and Terms.'
            )}
          </SectionCard>

          <SectionCard title="Budget tools">
            <View style={{ gap: Space[3] }}>
              {link('Manage categories', '/manage-categories')}
              {link('Reports', '/reports')}
            </View>
          </SectionCard>

          <SectionCard title="Guided tour">
            <Button
              label="Take the tour again"
              variant="secondary"
              accessibilityLabel="Take Budget Buddy's guided tour again. Your saved budget stays as it is."
              onPress={() => tour.start({ replay: true })}
            />
          </SectionCard>

          <SectionCard title="Appearance & accessibility">
            <ThemedText type="small" themeColor="textSecondary">
              Animations, including Budget Buddy’s, follow your device’s reduce-motion setting.
            </ThemedText>
          </SectionCard>
        </>
      )}
    </Screen>
  );
}
