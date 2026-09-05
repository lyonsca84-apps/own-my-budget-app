import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

/**
 * There's one grocery list per user in v1 (no multi-list UI yet) — this
 * finds it or creates it, so callers never have to think about list
 * management, just items.
 */
export async function getOrCreateDefaultGroceryList(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'grocery_lists'>> {
  const existing = await client
    .from('grocery_lists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await client.from('grocery_lists').insert({ user_id: userId }).select().single();
  if (created.error) throw created.error;
  return created.data;
}

export async function listGroceryItems(
  client: TypedSupabaseClient,
  groceryListId: string
): Promise<Tables<'grocery_items'>[]> {
  const { data, error } = await client
    .from('grocery_items')
    .select('*')
    .eq('grocery_list_id', groceryListId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function addGroceryItems(
  client: TypedSupabaseClient,
  userId: string,
  groceryListId: string,
  labels: string[]
): Promise<Tables<'grocery_items'>[]> {
  if (labels.length === 0) return [];
  const rows: TablesInsert<'grocery_items'>[] = labels.map((label) => ({
    user_id: userId,
    grocery_list_id: groceryListId,
    label,
  }));
  const { data, error } = await client.from('grocery_items').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function toggleGroceryItem(
  client: TypedSupabaseClient,
  itemId: string,
  isChecked: boolean
): Promise<void> {
  const { error } = await client
    .from('grocery_items')
    .update({ is_checked: isChecked })
    .eq('id', itemId);
  if (error) throw error;
}
