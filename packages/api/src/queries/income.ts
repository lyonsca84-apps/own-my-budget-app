import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export async function listIncomeSources(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'income_sources'>[]> {
  const { data, error } = await client
    .from('income_sources')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at');
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
