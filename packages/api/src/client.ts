import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Matches @react-native-async-storage/async-storage's shape — kept minimal so this package never depends on it directly. */
export interface AuthStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface SupabaseClientConfig {
  url: string;
  /** The publishable/anon key — never the service-role key. */
  publishableKey: string;
  /**
   * Where sessions get persisted. Native needs AsyncStorage (there's no
   * localStorage); web can omit this and let supabase-js use its own
   * localStorage default. Passed straight through to supabase-js's
   * `auth.storage` option.
   */
  storage?: AuthStorageAdapter;
  /**
   * Whether supabase-js should look for an OAuth/magic-link redirect
   * fragment in the current URL and parse a session from it — the correct
   * value on web, but on native the redirect never lands on a URL
   * supabase-js can read, so it must be false there or every non-web call
   * still gets a slow no-op URL parse attempt.
   */
  detectSessionInUrl: boolean;
}

/**
 * The one place UI code gets a Supabase client from. Screens should never
 * call `createClient` directly — that's how a service-role key or a wrong
 * project accidentally ends up in the client bundle.
 */
export function createSupabaseClient(config: SupabaseClientConfig): TypedSupabaseClient {
  if (!config.url || !config.publishableKey) {
    throw new Error(
      'createSupabaseClient: missing url or publishableKey. Check EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      storage: config.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: config.detectSessionInUrl,
      // PKCE is required for a secure OAuth/deep-link flow on native, and
      // is the modern default for web too — see docs/auth-setup.md.
      flowType: 'pkce',
    },
  });
}
