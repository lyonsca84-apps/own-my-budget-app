import { createGuestClient, type GuestClient } from './client';

/** Fixed "today" for deterministic tests: Sunday 2026-09-20, local noon. */
export const TEST_NOW = new Date(2026, 8, 20, 12, 0, 0);

/** The full demo dataset, frozen at {@link TEST_NOW}. */
export function seededClient(): GuestClient {
  return createGuestClient({ now: () => new Date(TEST_NOW) });
}

/** An empty database containing only the fake user's profile — for testing raw query semantics. */
export async function emptyClient(): Promise<GuestClient> {
  const client = createGuestClient({ seed: false, now: () => new Date(TEST_NOW) });
  const { error } = await client.guest.service
    .from('profiles')
    .insert({ id: client.guest.userId, display_name: 'Test' });
  if (error) throw error;
  return client;
}
