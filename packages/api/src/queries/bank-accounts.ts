import type { TypedSupabaseClient } from '../client';
import type { Tables } from '../database.types';

export async function listAccounts(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'accounts'>[]> {
  const { data, error } = await client
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at');
  if (error) throw error;
  return data;
}
