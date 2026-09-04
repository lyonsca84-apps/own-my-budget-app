import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export async function listPaychecks(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'paychecks'>[]> {
  const { data, error } = await client
    .from('paychecks')
    .select('*')
    .eq('user_id', userId)
    .order('pay_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPaycheck(
  client: TypedSupabaseClient,
  paycheckId: string
): Promise<Tables<'paychecks'>> {
  const { data, error } = await client.from('paychecks').select('*').eq('id', paycheckId).single();
  if (error) throw error;
  return data;
}

export async function createPaycheck(
  client: TypedSupabaseClient,
  paycheck: TablesInsert<'paychecks'>
): Promise<Tables<'paychecks'>> {
  const { data, error } = await client.from('paychecks').insert(paycheck).select().single();
  if (error) throw error;
  return data;
}

export async function markPaycheckAssigned(
  client: TypedSupabaseClient,
  paycheckId: string
): Promise<void> {
  const { error } = await client
    .from('paychecks')
    .update({ is_assigned: true })
    .eq('id', paycheckId);
  if (error) throw error;
}
