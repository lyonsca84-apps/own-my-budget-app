import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export interface DebtWithPayments extends Tables<'debts'> {
  debt_payments: Pick<Tables<'debt_payments'>, 'amount_cents'>[];
}

export async function listDebtsWithPayments(
  client: TypedSupabaseClient,
  userId: string
): Promise<DebtWithPayments[]> {
  const { data, error } = await client
    .from('debts')
    .select('*, debt_payments(amount_cents)')
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
