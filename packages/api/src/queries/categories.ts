import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export async function listCategories(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'categories'>[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('name');
  if (error) throw error;
  return data;
}

export async function createCategory(
  client: TypedSupabaseClient,
  category: TablesInsert<'categories'>
): Promise<Tables<'categories'>> {
  const { data, error } = await client.from('categories').insert(category).select().single();
  if (error) throw error;
  return data;
}
