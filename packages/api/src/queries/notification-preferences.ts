import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesUpdate } from '../database.types';

/** Every user has a row from the signup trigger — see migration 20260904200100. */
export async function getNotificationPreferences(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'notification_preferences'>> {
  const { data, error } = await client
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateNotificationPreferences(
  client: TypedSupabaseClient,
  userId: string,
  patch: TablesUpdate<'notification_preferences'>
): Promise<Tables<'notification_preferences'>> {
  const { data, error } = await client
    .from('notification_preferences')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
