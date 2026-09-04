import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseClientConfig {
  url: string;
  /** The publishable/anon key — never the service-role key. */
  publishableKey: string;
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
  return createClient<Database>(config.url, config.publishableKey);
}
