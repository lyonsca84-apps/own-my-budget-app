import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesUpdate } from '../database.types';

export async function getProfile(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'profiles'>> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  client: TypedSupabaseClient,
  userId: string,
  updates: TablesUpdate<'profiles'>
): Promise<Tables<'profiles'>> {
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
