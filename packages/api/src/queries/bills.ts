import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

export interface BillWithPayments extends Tables<'bills'> {
  bill_payments: Pick<Tables<'bill_payments'>, 'amount_cents' | 'paid_on'>[];
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
    .select('*, bill_payments(amount_cents, paid_on)')
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

/**
 * Unlike debt/goal payments, this is a plain insert with no companion
 * running-total update — bill status is fully derived (see packages/core's
 * deriveBillStatus), so there's nothing else to keep in sync.
 */
export async function recordBillPayment(
  client: TypedSupabaseClient,
  payment: TablesInsert<'bill_payments'>
): Promise<Tables<'bill_payments'>> {
  const { data, error } = await client.from('bill_payments').insert(payment).select().single();
  if (error) throw error;
  return data;
}

export async function updateBill(
  client: TypedSupabaseClient,
  billId: string,
  changes: TablesUpdate<'bills'>
): Promise<Tables<'bills'>> {
  const { data, error } = await client
    .from('bills')
    .update(changes)
    .eq('id', billId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getBill(
  client: TypedSupabaseClient,
  billId: string
): Promise<Tables<'bills'>> {
  const { data, error } = await client.from('bills').select('*').eq('id', billId).single();
  if (error) throw error;
  return data;
}

/** Removes a bill from every list while keeping its payment history. */
export async function archiveBill(client: TypedSupabaseClient, billId: string): Promise<void> {
  const { error } = await client
    .from('bills')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', billId);
  if (error) throw error;
}

/** One planned slice of a bill or debt payment, assigned to a payday (pay schedule + date). */
export interface PaydayPlanPortion {
  incomeSourceId: string;
  /** YYYY-MM-DD */
  payDate: string;
  amountCents: number;
}

/**
 * Replaces the whole "Plan payment" split for one bill or debt using the
 * shared `payday_assignments` table (also read by the Budget view). New
 * portions are upserted first and stale ones deleted after, so a failure
 * part-way never leaves the target with its plan wiped. Portions that land
 * on the same payday are merged, matching the table's unique key. An empty
 * list clears the plan. Planning never touches balances.
 */
export async function replacePaydayPlan(
  client: TypedSupabaseClient,
  userId: string,
  target: { type: 'bill' | 'debt'; id: string },
  portions: PaydayPlanPortion[]
): Promise<void> {
  const merged = new Map<string, PaydayPlanPortion>();
  for (const portion of portions) {
    const key = `${portion.incomeSourceId}|${portion.payDate}`;
    const existing = merged.get(key);
    merged.set(
      key,
      existing ? { ...existing, amountCents: existing.amountCents + portion.amountCents } : portion
    );
  }

  const { data: existingRows, error: listError } = await client
    .from('payday_assignments')
    .select('id, income_source_id, pay_date')
    .eq('user_id', userId)
    .eq('target_type', target.type)
    .eq('target_id', target.id);
  if (listError) throw listError;

  if (merged.size > 0) {
    const { error: upsertError } = await client.from('payday_assignments').upsert(
      [...merged.values()].map((p) => ({
        user_id: userId,
        income_source_id: p.incomeSourceId,
        pay_date: p.payDate,
        target_type: target.type,
        target_id: target.id,
        amount_cents: p.amountCents,
      })),
      { onConflict: 'income_source_id,pay_date,target_type,target_id' }
    );
    if (upsertError) throw upsertError;
  }

  const staleIds = existingRows
    .filter((row) => !merged.has(`${row.income_source_id}|${row.pay_date}`))
    .map((row) => row.id);
  if (staleIds.length > 0) {
    const { error: deleteError } = await client
      .from('payday_assignments')
      .delete()
      .in('id', staleIds);
    if (deleteError) throw deleteError;
  }
}
