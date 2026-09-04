import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export interface BillWithPayments extends Tables<'bills'> {
  bill_payments: Pick<Tables<'bill_payments'>, 'amount_cents'>[];
}

/**
 * Returns bills with their payments attached (not a computed status —
 * deriving 'paid' | 'upcoming' | 'overdue' from amount/payments/due-date is
 * packages/core's job, kept out of this data-access layer on purpose).
 */
export async function listBillsWithPayments(
  client: TypedSupabaseClient,
  userId: string
): Promise<BillWithPayments[]> {
  const { data, error } = await client
    .from('bills')
    .select('*, bill_payments(amount_cents)')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('due_date');
  if (error) throw error;
  return data;
}

export async function createBill(
  client: TypedSupabaseClient,
  bill: TablesInsert<'bills'>
): Promise<Tables<'bills'>> {
  const { data, error } = await client.from('bills').insert(bill).select().single();
  if (error) throw error;
  return data;
}
