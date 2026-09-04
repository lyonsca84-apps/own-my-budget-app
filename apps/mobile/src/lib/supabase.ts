import { createSupabaseClient } from '@own-my-budget/api';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabase = createSupabaseClient({ url, publishableKey });
