import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export async function listTransactions(
  client: TypedSupabaseClient,
  userId: string,
  options?: { fromDate?: string; toDate?: string }
): Promise<Tables<'transactions'>[]> {
  let query = client
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false });

  if (options?.fromDate) query = query.gte('occurred_on', options.fromDate);
  if (options?.toDate) query = query.lte('occurred_on', options.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTransaction(
  client: TypedSupabaseClient,
  transaction: TablesInsert<'transactions'>
): Promise<Tables<'transactions'>> {
  const { data, error } = await client.from('transactions').insert(transaction).select().single();
  if (error) throw error;
  return data;
}
