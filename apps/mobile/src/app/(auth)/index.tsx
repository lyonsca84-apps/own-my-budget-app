import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const theme = useTheme();
  const { continueAsGuest } = useAuth();

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.five }}
        >
          <View style={{ alignItems: 'center', gap: Spacing.three }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: Spacing.three,
                backgroundColor: theme.primary,
              }}
            />
            <ThemedText type="title" style={{ fontSize: 28, textAlign: 'center' }}>
              Own My Budget
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
              A clear, calm look at your money — no jargon, no shame, no homework.
            </ThemedText>
          </View>

          <View style={{ gap: Spacing.three }}>
            <Button label="Get started" onPress={() => router.push('/sign-up')} />
            <Button label="Log in" variant="secondary" onPress={() => router.push('/sign-in')} />
            <Button
              label="Continue as guest"
              variant="secondary"
              onPress={() => {
                continueAsGuest();
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
