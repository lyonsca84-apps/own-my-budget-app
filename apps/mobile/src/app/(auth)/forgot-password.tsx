import { router } from 'expo-router';
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

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await requestPasswordReset(email.trim());
    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.five }}>
            <Card style={{ gap: Spacing.two, alignItems: 'center' }}>
              <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                Check your email
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                If an account exists for {email}, we sent a link to reset your password.
              </ThemedText>
              <Button label="Back to log in" onPress={() => router.replace('/sign-in')} />
            </Card>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.four }}
        >
          <View>
            <ThemedText type="title" style={{ fontSize: 24 }}>
              Reset your password
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
              We&apos;ll email you a link to set a new one.
            </ThemedText>
          </View>

          <View style={{ gap: Spacing.three }}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            {errorMessage ? (
              <ThemedText type="small" themeColor="danger">
                {errorMessage}
              </ThemedText>
            ) : null}
            <Button
              label={isSubmitting ? 'Sending…' : 'Send reset link'}
              onPress={handleSubmit}
              disabled={isSubmitting || !email}
            />
          </View>

          <Button
            label="Back to log in"
            variant="secondary"
            onPress={() => router.replace('/sign-in')}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
