import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

export interface DebtWithPayments extends Tables<'debts'> {
  debt_payments: Pick<Tables<'debt_payments'>, 'amount_cents' | 'paid_on'>[];
}

export async function listDebtsWithPayments(
  client: TypedSupabaseClient,
  userId: string
): Promise<DebtWithPayments[]> {
  const { data, error } = await client
    .from('debts')
    .select('*, debt_payments(amount_cents, paid_on)')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function createDebt(
  client: TypedSupabaseClient,
  debt: TablesInsert<'debts'>
): Promise<Tables<'debts'>> {
  const { data, error } = await client.from('debts').insert(debt).select().single();
  if (error) throw error;
  return data;
}

/**
 * Records a payment and decrements the debt's running balance atomically,
 * via the `record_debt_payment` Postgres function — never as two separate
 * client calls, which could leave a payment recorded with no matching
 * balance change (or vice versa) if the second call failed.
 */
export async function recordDebtPayment(
  client: TypedSupabaseClient,
  args: { debtId: string; amountCents: number; paidOn: string }
): Promise<Tables<'debt_payments'>> {
  const { data, error } = await client.rpc('record_debt_payment', {
    p_debt_id: args.debtId,
    p_amount_cents: args.amountCents,
    p_paid_on: args.paidOn,
  });
  if (error) throw error;
  return data;
}

export async function updateDebt(
  client: TypedSupabaseClient,
  debtId: string,
  changes: TablesUpdate<'debts'>
): Promise<Tables<'debts'>> {
  const { data, error } = await client
    .from('debts')
    .update(changes)
    .eq('id', debtId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDebt(
  client: TypedSupabaseClient,
  debtId: string
): Promise<Tables<'debts'>> {
  const { data, error } = await client.from('debts').select('*').eq('id', debtId).single();
  if (error) throw error;
  return data;
}

/** "Delete" for a card or loan: archived rows drop out of every list but keep their payment history. */
export async function archiveDebt(client: TypedSupabaseClient, debtId: string): Promise<void> {
  const { error } = await client
    .from('debts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', debtId);
  if (error) throw error;
}

/** The user's payoff preferences (strategy, extra per month, card payoff goal) — null until first saved. */
export async function getPayoffPlan(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'payoff_plans'> | null> {
  const { data, error } = await client
    .from('payoff_plans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates or updates the user's single payoff-plan row (one per user — see migration 20260920100000). */
export async function savePayoffPlan(
  client: TypedSupabaseClient,
  userId: string,
  changes: Omit<TablesUpdate<'payoff_plans'>, 'user_id' | 'id'>
): Promise<Tables<'payoff_plans'>> {
  const { data, error } = await client
    .from('payoff_plans')
    .upsert({ ...changes, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
