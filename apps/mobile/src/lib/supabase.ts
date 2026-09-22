import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  GUEST_USER_ID,
  createGuestClient,
  createSupabaseClient,
  type GuestClient,
  type TypedSupabaseClient,
} from '@own-my-budget/api';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * The real Supabase client. Only auth plumbing (AuthProvider) should reach for
 * this directly — everything else uses `supabase` below, which is this client
 * for a signed-in user and an in-memory demo database for a guest.
 */
export const realSupabase = createSupabaseClient({
  url,
  publishableKey,
  // On web, supabase-js's own localStorage default plus reading the OAuth
  // redirect fragment out of the URL is correct. On native there's no
  // window/localStorage and no URL to read — AsyncStorage plus expo-router's
  // deep-link handling (see auth-context.tsx) does that job instead.
  storage: Platform.OS === 'web' ? undefined : AsyncStorage,
  detectSessionInUrl: Platform.OS === 'web',
});

let guestClient: GuestClient | null = null;
let activeClient: TypedSupabaseClient = realSupabase;

/**
 * The client every screen imports. It is a thin forwarding proxy, so screens
 * keep writing `listBills(supabase, userId)`: in guest mode the call is served
 * by the in-memory guest client (same query code, same constraints, demo
 * data), and once the guest signs in or exits it goes to the real project
 * again. The proxy's identity never changes, so it's safe in effect deps.
 */
export const supabase: TypedSupabaseClient = new Proxy({} as TypedSupabaseClient, {
  get(_target, property) {
    const value = Reflect.get(activeClient as object, property);
    return typeof value === 'function' ? value.bind(activeClient) : value;
  },
  has: (_target, property) => property in (activeClient as object),
});

/** The user id to query with: the fake guest id in guest mode, else the real user's id. */
export const guestUserId = GUEST_USER_ID;

/**
 * Points `supabase` at the guest (in-memory) client, creating and seeding it on
 * first use. Called by AuthProvider — screens don't need to.
 */
export function activateGuestData(): void {
  guestClient ??= createGuestClient();
  activeClient = guestClient;
}

/** Points `supabase` back at the real project. */
export function deactivateGuestData(): void {
  activeClient = realSupabase;
}

/** True while `supabase` is serving the in-memory guest database. */
export function isGuestDataActive(): boolean {
  return guestClient !== null && activeClient === guestClient;
}

/**
 * Throws away every guest edit and restores the seeded demo data (dates are
 * re-anchored to today). No-op when nothing has been seeded yet. Screens that
 * are already showing guest data should reload afterwards — the auth context's
 * `guestDataVersion` changes to signal exactly that.
 */
export function resetGuestData(): void {
  guestClient?.guest.reset();
}
