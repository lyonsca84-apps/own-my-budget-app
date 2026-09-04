import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createSupabaseClient } from '@own-my-budget/api';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabase = createSupabaseClient({
  url,
  publishableKey,
  // On web, supabase-js's own localStorage default plus reading the OAuth
  // redirect fragment out of the URL is correct. On native there's no
  // window/localStorage and no URL to read — AsyncStorage plus expo-router's
  // deep-link handling (see auth-context.tsx) does that job instead.
  storage: Platform.OS === 'web' ? undefined : AsyncStorage,
  detectSessionInUrl: Platform.OS === 'web',
});
