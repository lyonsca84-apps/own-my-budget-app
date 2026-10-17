import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
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

export default function SignInScreen() {
  const theme = useTheme();
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
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: Spacing.four,
          }}
        >
          <Card style={{ width: '100%', maxWidth: 400, gap: Spacing.four }}>
            <View style={{ alignItems: 'center', gap: Spacing.one }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: Spacing.four,
                  backgroundColor: theme.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: Spacing.two,
                }}
              >
                <ThemedText
                  type="title"
                  themeColor="primary"
                  style={{ fontSize: 24, lineHeight: 28 }}
                >
                  $
                </ThemedText>
              </View>
              <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 28 }}>
                Welcome back
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Log in to keep your budget on track.
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
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/forgot-password')}
                  hitSlop={8}
                >
                  <ThemedText type="link" themeColor="primary">
                    Forgot password?
                  </ThemedText>
                </Pressable>
              </View>

              {errorMessage ? (
                <ThemedText type="small" themeColor="danger">
                  {errorMessage}
                </ThemedText>
              ) : null}

              <Button
                label={isSubmitting ? 'Logging in…' : 'Log in'}
                variant="panel"
                onPress={handleSignIn}
                disabled={isSubmitting || !email || !password}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <ThemedText type="small" themeColor="textSecondary">
                Or continue with
              </ThemedText>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.three }}>
              <IconButton
                accessibilityLabel="Continue with Google"
                onPress={() => signInWithGoogle()}
              >
                <GoogleLogo />
              </IconButton>
              <IconButton
                accessibilityLabel="Continue with Apple"
                onPress={() => signInWithApple()}
              >
                <AppleLogo color={theme.text} />
              </IconButton>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/sign-up')}
              style={{ alignItems: 'center' }}
              hitSlop={8}
            >
              <ThemedText type="small" themeColor="textSecondary">
                New here?{' '}
                <ThemedText type="smallBold" themeColor="primary">
                  Create an account
                </ThemedText>
              </ThemedText>
            </Pressable>
          </Card>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
