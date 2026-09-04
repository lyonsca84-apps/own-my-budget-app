import type { TypedSupabaseClient } from '../client';
import type { Tables } from '../database.types';

export interface CurrentAccount {
  profile: Tables<'profiles'>;
  settings: Tables<'user_settings'>;
  entitlement: Tables<'entitlements'>;
}

/**
 * Everything almost every authenticated screen needs: the signed-in user's
 * profile, presentation settings, and current plan tier. RLS already
 * guarantees each of these queries can only ever return the caller's own
 * row — there's no user_id filter to get wrong here.
 */
export async function getCurrentAccount(
  client: TypedSupabaseClient,
  userId: string
): Promise<CurrentAccount> {
  const [profile, settings, entitlement] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).single(),
    client.from('user_settings').select('*').eq('user_id', userId).single(),
    client.from('entitlements').select('*').eq('user_id', userId).single(),
  ]);

  if (profile.error) throw profile.error;
  if (settings.error) throw settings.error;
  if (entitlement.error) throw entitlement.error;

  return { profile: profile.data, settings: settings.data, entitlement: entitlement.data };
}
