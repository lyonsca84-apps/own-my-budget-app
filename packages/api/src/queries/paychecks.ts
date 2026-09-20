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

/**
 * Payday planning: which paycheck (identified by pay schedule + date) is
 * meant to cover which bill, debt payment, or savings contribution.
 * Planning never changes a balance — only recording a payment does.
 */
export type PaydayTargetType = 'bill' | 'debt' | 'savings_goal';

export async function listPaydayAssignments(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'payday_assignments'>[]> {
  const { data, error } = await client
    .from('payday_assignments')
    .select('*')
    .eq('user_id', userId)
    .order('pay_date');
  if (error) throw error;
  return data;
}

export async function assignPaymentToPayday(
  client: TypedSupabaseClient,
  assignment: TablesInsert<'payday_assignments'>
): Promise<Tables<'payday_assignments'>> {
  const { data, error } = await client
    .from('payday_assignments')
    .upsert(assignment, { onConflict: 'income_source_id,pay_date,target_type,target_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removePaydayAssignment(
  client: TypedSupabaseClient,
  assignmentId: string
): Promise<void> {
  const { error } = await client.from('payday_assignments').delete().eq('id', assignmentId);
  if (error) throw error;
}
