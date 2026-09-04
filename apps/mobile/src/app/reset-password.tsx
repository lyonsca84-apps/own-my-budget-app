import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';

/**
 * Top-level (not under (auth) or (tabs)) because it needs its own guard:
 * clicking the password-reset email link creates a real Supabase session,
 * so this screen must show even though the user is technically "signed
 * in" — see the 'passwordRecovery' status in auth-context.tsx.
 */
export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setIsSubmitting(false);
    if (error) setErrorMessage(error);
    // On success, status flips out of 'passwordRecovery' and RootNavigator
    // moves on to (tabs) automatically.
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.four }}
        >
          <View>
            <ThemedText type="title" style={{ fontSize: 24 }}>
              Set a new password
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
              Choose a new password for your account.
            </ThemedText>
          </View>

          <View style={{ gap: Spacing.three }}>
            <TextField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {errorMessage ? (
              <ThemedText type="small" themeColor="danger">
                {errorMessage}
              </ThemedText>
            ) : null}
            <Button
              label={isSubmitting ? 'Saving…' : 'Save new password'}
              onPress={handleSubmit}
              disabled={isSubmitting || newPassword.length < 6}
            />
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
