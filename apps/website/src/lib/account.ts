// Supabase session + entitlement access for the website. Uses the shared
// @own-my-budget/api client factory (same project and auth as the app), with
// only the public publishable key — the service-role key never reaches here.
import {
  createSupabaseClient,
  getCurrentAccount,
  type CurrentAccount,
  type TypedSupabaseClient,
} from '@own-my-budget/api';
import type { Session } from '@supabase/supabase-js';

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Where "Open my budget" goes — the Expo web app. Optional. */
  appUrl: (import.meta.env.VITE_APP_URL ?? '').replace(/\/$/, ''),
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? '',
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseKey);

let client: TypedSupabaseClient | null = null;

/** Null when the site was built without Supabase settings — callers show a setup message instead of crashing. */
export function getClient(): TypedSupabaseClient | null {
  if (!isConfigured) return null;
  client ??= createSupabaseClient({
    url: config.supabaseUrl,
    publishableKey: config.supabaseKey,
    detectSessionInUrl: true,
  });
  return client;
}

export async function getSession(): Promise<Session | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function loadAccount(session: Session): Promise<CurrentAccount> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  return getCurrentAccount(supabase, session.user.id);
}

export type Entitlement = CurrentAccount['entitlement'];

/** A paid plan the user should manage in the Customer Portal rather than buy again. */
export function hasActiveSubscription(e: Entitlement): boolean {
  return e.plan_tier !== 'free' && e.status !== 'canceled';
}

/** Sends signed-out visitors to /login, preserving where they were headed. */
export function redirectToLogin(): void {
  const next = window.location.pathname + window.location.search;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}

/** Only same-site paths are honored for ?next= so the login page can't be used as an open redirect. */
export function safeNextPath(raw: string | null, fallback = '/account'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export const NOT_CONFIGURED_MESSAGE =
  'Accounts are not connected in this preview yet. The site owner needs to add the Supabase settings (see apps/website/README.md).';
