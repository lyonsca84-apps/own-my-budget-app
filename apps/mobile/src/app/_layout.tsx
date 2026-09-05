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

/** Every screen pushed on top of the tab shell — all modals with a header. */
const MODAL_SCREENS: { name: string; title: string }[] = [
  { name: 'settings', title: 'Settings' },
  { name: 'add-category', title: 'Add category' },
  { name: 'add-income', title: 'Add income' },
  { name: 'add-paycheck', title: 'Log a paycheck' },
  { name: 'assign-paycheck', title: 'Assign paycheck' },
  { name: 'add-bill', title: 'Add bill' },
  { name: 'record-bill-payment', title: 'Record payment' },
  { name: 'add-debt', title: 'Add debt' },
  { name: 'record-debt-payment', title: 'Record payment' },
  { name: 'add-savings-goal', title: 'Add savings goal' },
  { name: 'add-goal-activity', title: 'Goal activity' },
  { name: 'scan-receipt', title: 'Scan receipt' },
  { name: 'review-receipt', title: 'Review receipt' },
  { name: 'scan-pantry', title: 'Scan pantry' },
  { name: 'review-pantry', title: 'Review pantry scan' },
  { name: 'grocery-list', title: 'Grocery list' },
  { name: 'reports', title: 'Reports' },
  { name: 'report-spending', title: 'Spending by category' },
  { name: 'report-income-expenses', title: 'Income vs. expenses' },
  { name: 'report-debt-savings', title: 'Debt & savings progress' },
  { name: 'export-data', title: 'Export your data' },
  { name: 'notification-settings', title: 'Notifications' },
  { name: 'manage-categories', title: 'Manage categories' },
  { name: 'security', title: 'Security' },
  { name: 'data-privacy', title: 'Data & privacy' },
  { name: 'help-legal', title: 'Help, FAQ & legal' },
];

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
        {MODAL_SCREENS.map((screen) => (
          <Stack.Screen
            key={screen.name}
            name={screen.name}
            options={{ presentation: 'modal', headerShown: true, title: screen.title }}
          />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut' || status === 'loading'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
