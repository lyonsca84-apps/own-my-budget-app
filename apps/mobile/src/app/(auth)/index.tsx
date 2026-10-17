import { router } from 'expo-router';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { BrandAssets } from '@/design-system/assets/brand';
import { Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const { continueAsGuest } = useAuth();

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.five }}
        >
          <View style={{ alignItems: 'center', gap: Spacing.three }}>
            <Image
              source={BrandAssets.verticalLockup}
              contentFit="contain"
              style={{ width: 220, height: 220 }}
              accessibilityLabel="Own My Budget"
            />
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
              A clear, calm look at your money — no jargon, no shame, no homework.
            </ThemedText>
          </View>

          <View style={{ gap: Spacing.three }}>
            <Button label="Get started" variant="panel" onPress={() => router.push('/sign-up')} />
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
