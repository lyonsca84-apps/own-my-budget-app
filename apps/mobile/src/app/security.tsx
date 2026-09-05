import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';

/**
 * Face ID / passcode app-lock (PLAN.md screen #68) is deliberately not
 * built here — it's a real native biometric feature (expo-local-
 * authentication) that can't be meaningfully verified without a physical
 * device or a simulator with biometrics enrolled, unlike everything else
 * built this phase. Change password is the part of "Security" that's
 * fully testable in this environment.
 */
export default function SecurityScreen() {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit() {
    setStatusMessage(null);
    setIsSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setIsSubmitting(false);
    if (error) {
      setIsError(true);
      setStatusMessage(error);
    } else {
      setIsError(false);
      setStatusMessage('Password updated.');
      setNewPassword('');
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: Spacing.five, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Security
          </ThemedText>

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">Change password</ThemedText>
            <TextField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {statusMessage ? (
              <ThemedText type="small" themeColor={isError ? 'danger' : 'success'}>
                {statusMessage}
              </ThemedText>
            ) : null}
            <Button
              label={isSubmitting ? 'Saving…' : 'Update password'}
              onPress={handleSubmit}
              disabled={isSubmitting || newPassword.length < 6}
            />
          </Card>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
