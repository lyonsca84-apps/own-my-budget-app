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

export async function renameCategory(
  client: TypedSupabaseClient,
  categoryId: string,
  name: string
): Promise<void> {
  const { error } = await client.from('categories').update({ name }).eq('id', categoryId);
  if (error) throw error;
}

/**
 * Soft-delete (archived_at, not a real delete) — bills/budget lines/
 * transactions already referencing this category keep working, they just
 * stop offering it for new assignments. Matches the pattern already used
 * for bills/debts/savings goals.
 */
export async function archiveCategory(
  client: TypedSupabaseClient,
  categoryId: string
): Promise<void> {
  const { error } = await client
    .from('categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', categoryId);
  if (error) throw error;
}
