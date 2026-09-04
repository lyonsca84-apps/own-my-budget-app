import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (error) setErrorMessage(error);
    // On success, RootNavigator's guard swaps to (tabs) on its own — no
    // manual navigation needed here.
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.four }}
        >
          <ThemedText type="title" style={{ fontSize: 24 }}>
            Welcome back
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
              autoComplete="current-password"
              textContentType="password"
            />
            {errorMessage ? (
              <ThemedText type="small" themeColor="danger">
                {errorMessage}
              </ThemedText>
            ) : null}
            <Button
              label={isSubmitting ? 'Logging in…' : 'Log in'}
              onPress={handleSignIn}
              disabled={isSubmitting || !email || !password}
            />
            <Button
              label="Forgot password?"
              variant="secondary"
              onPress={() => router.push('/forgot-password')}
            />
          </View>

          <View style={{ gap: Spacing.two }}>
            <Button
              label="Continue with Google"
              variant="secondary"
              onPress={() => signInWithGoogle()}
            />
            <Button
              label="Continue with Apple"
              variant="secondary"
              onPress={() => signInWithApple()}
            />
          </View>

          <Button
            label="New here? Create an account"
            variant="secondary"
            onPress={() => router.replace('/sign-up')}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
