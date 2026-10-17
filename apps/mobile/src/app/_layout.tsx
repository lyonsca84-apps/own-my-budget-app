import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useWindowDimensions, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TourCoach } from '@/components/tour/tour-coach';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { TourProvider } from '@/contexts/tour-context';
import { Colors, Layout } from '@/constants/theme';
import { useBrandFonts } from '@/design-system/use-brand-fonts';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useBrandFonts();

  // Keep the native splash screen up (already told not to auto-hide, above)
  // until Poppins/Figtree/IBM Plex Mono are ready — otherwise every screen
  // flashes system-font text for a frame before the brand type swaps in.
  if (!fontsLoaded && !fontError) return null;

  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.backgroundElement,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <TourProvider>
          <View style={{ flex: 1 }}>
            <AnimatedSplashOverlay />
            <RootNavigator />
            {/* Budget Buddy's guided tour docks above whichever real screen is open. */}
            <TourCoach />
          </View>
        </TourProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Every screen pushed on top of the tab shell — all modals with a header. */
const MODAL_SCREENS: { name: string; title: string }[] = [
  { name: 'settings', title: 'Settings' },
  { name: 'profile', title: 'Profile' },
  { name: 'add-category', title: 'Add category' },
  { name: 'add-income', title: 'Add income' },
  { name: 'add-transaction', title: 'Add transaction' },
  { name: 'add-paycheck', title: 'Log a paycheck' },
  { name: 'assign-paycheck', title: 'Assign paycheck' },
  { name: 'add-bill', title: 'Add bill' },
  { name: 'record-bill-payment', title: 'Record payment' },
  { name: 'add-debt', title: 'Add debt' },
  { name: 'record-debt-payment', title: 'Record payment' },
  { name: 'plan-payment', title: 'Plan payment' },
  { name: 'card-details', title: 'Card details' },
  { name: 'add-savings-goal', title: 'Add savings goal' },
  { name: 'add-goal-activity', title: 'Goal activity' },
  { name: 'savings-challenge', title: '52-Week Money Challenge' },
  { name: 'scan-receipt', title: 'Scan receipt' },
  { name: 'review-receipt', title: 'Review receipt' },
  { name: 'scan-pantry', title: 'Scan pantry' },
  { name: 'review-pantry', title: 'Review pantry scan' },
  { name: 'grocery-list', title: 'Grocery list' },
  { name: 'reports', title: 'Reports' },
  { name: 'helper', title: 'Budget Buddy' },
  { name: 'report-spending', title: 'Spending by category' },
  { name: 'report-income-expenses', title: 'Income vs. expenses' },
  { name: 'report-debt-savings', title: 'Debt & savings progress' },
  { name: 'export-data', title: 'Export your data' },
  { name: 'notification-settings', title: 'Notifications' },
  { name: 'manage-categories', title: 'Manage categories' },
  { name: 'security', title: 'Security' },
  { name: 'data-privacy', title: 'Data & privacy' },
  { name: 'help-legal', title: 'Help, FAQ & legal' },
  { name: 'subscription', title: 'Subscription & plan' },
  { name: 'paywall', title: 'Choose your plan' },
];

/**
 * Routes whose screen renders `<DialogScreen>` (components/ui/dialog). On web
 * these use `transparentModal` so the previous page stays visible behind the
 * dimmed backdrop, with no header on wide screens (the dialog draws its own
 * title); on narrow web and native they keep the standard modal + header.
 *
 * Add a route name here only once its screen has been converted to
 * `<DialogScreen>` — an unconverted screen would lose its header on wide web.
 * Grocery / Reports / Budget Buddy / scan-* / review-* / report-* stay out.
 */
const DIALOG_SCREENS = new Set<string>([
  'add-transaction',
  'manage-categories',
  'add-category',
  'add-income',
  'add-paycheck',
  'assign-paycheck',
  'add-bill',
  'record-bill-payment',
  'add-debt',
  'record-debt-payment',
  'plan-payment',
  'card-details',
  'add-savings-goal',
  'add-goal-activity',
  'savings-challenge',
]);

/**
 * Route protection: signed-in and guest users get the tab shell; everyone
 * else (including the brief moment before the initial session check
 * resolves) gets the auth flow. `Stack.Protected`'s `guard` decides which
 * group is even mounted — there's no manual redirect logic to get wrong.
 */
function RootNavigator() {
  const { status } = useAuth();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= Layout.sidebarBreakpoint;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'passwordRecovery'}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsOnboarding'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' || status === 'guest'}>
        <Stack.Screen name="(tabs)" />
        {MODAL_SCREENS.map((screen) => (
          <Stack.Screen
            key={screen.name}
            name={screen.name}
            options={
              DIALOG_SCREENS.has(screen.name) && Platform.OS === 'web'
                ? {
                    presentation: 'transparentModal',
                    animation: 'fade',
                    headerShown: !isWideWeb,
                    title: screen.title,
                  }
                : { presentation: 'modal', headerShown: true, title: screen.title }
            }
          />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut' || status === 'loading'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
