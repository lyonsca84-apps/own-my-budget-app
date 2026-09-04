import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Route protection: signed-in and guest users get the tab shell; everyone
 * else (including the brief moment before the initial session check
 * resolves) gets the auth flow. `Stack.Protected`'s `guard` decides which
 * group is even mounted — there's no manual redirect logic to get wrong.
 */
function RootNavigator() {
  const { status } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'passwordRecovery'}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' || status === 'guest'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: true }} />
        <Stack.Screen
          name="add-category"
          options={{ presentation: 'modal', headerShown: true, title: 'Add category' }}
        />
        <Stack.Screen
          name="add-income"
          options={{ presentation: 'modal', headerShown: true, title: 'Add income' }}
        />
        <Stack.Screen
          name="add-paycheck"
          options={{ presentation: 'modal', headerShown: true, title: 'Log a paycheck' }}
        />
        <Stack.Screen
          name="assign-paycheck"
          options={{ presentation: 'modal', headerShown: true, title: 'Assign paycheck' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut' || status === 'loading'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
