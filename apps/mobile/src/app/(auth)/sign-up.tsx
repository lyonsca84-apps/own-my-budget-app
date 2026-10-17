import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppleLogo, GoogleLogo } from '@/components/ui/social-icons';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const { signUp, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  async function handleSignUp() {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await signUp(email.trim(), password);
    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    // A session comes back immediately only if email confirmation is off.
    // Either way, telling the user to check their inbox is the safe default.
    setCheckYourEmail(true);
  }

  if (checkYourEmail) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.five }}>
            <Card style={{ gap: Spacing.two, alignItems: 'center' }}>
              <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                Check your email
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                We sent a confirmation link to {email}. Follow it to finish creating your account,
                then come back and log in.
              </ThemedText>
              <Button
                label="Back to log in"
                variant="panel"
                onPress={() => router.replace('/sign-in')}
              />
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
          <ThemedText type="title" style={{ fontSize: 24 }}>
            Create your account
          </ThemedText>

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
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
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
              label={isSubmitting ? 'Creating account…' : 'Create account'}
              variant="panel"
              onPress={handleSignUp}
              disabled={isSubmitting || !email || !password}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.three }}>
            <IconButton
              accessibilityLabel="Continue with Google"
              onPress={() => signInWithGoogle()}
            >
              <GoogleLogo />
            </IconButton>
            <IconButton accessibilityLabel="Continue with Apple" onPress={() => signInWithApple()}>
              <AppleLogo color={theme.text} />
            </IconButton>
          </View>

          <Button
            label="Already have an account? Log in"
            variant="secondary"
            onPress={() => router.replace('/sign-in')}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
