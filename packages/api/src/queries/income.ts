import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

export async function listIncomeSources(
  client: TypedSupabaseClient,
  userId: string,
  options?: { includeArchived?: boolean }
): Promise<Tables<'income_sources'>[]> {
  let query = client.from('income_sources').select('*').eq('user_id', userId);
  if (!options?.includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query.order('created_at');
  if (error) throw error;
  return data;
}

export async function getIncomeSource(
  client: TypedSupabaseClient,
  incomeSourceId: string
): Promise<Tables<'income_sources'>> {
  const { data, error } = await client
    .from('income_sources')
    .select('*')
    .eq('id', incomeSourceId)
    .single();
  if (error) throw error;
  return data;
}

/** Edits a pay schedule. Set `archived_at` to pause it (or null to resume) — schedules are never hard-deleted. */
export async function updateIncomeSource(
  client: TypedSupabaseClient,
  incomeSourceId: string,
  changes: TablesUpdate<'income_sources'>
): Promise<Tables<'income_sources'>> {
  const { data, error } = await client
    .from('income_sources')
    .update(changes)
    .eq('id', incomeSourceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createIncomeSource(
  client: TypedSupabaseClient,
  incomeSource: TablesInsert<'income_sources'>
): Promise<Tables<'income_sources'>> {
  const { data, error } = await client
    .from('income_sources')
    .insert(incomeSource)
    .select()
    .single();
  if (error) throw error;
  return data;
}
