import type { TypedSupabaseClient } from '../client';

export interface DateRange {
  fromDate?: string;
  toDate?: string;
}

export interface BillPaymentForReport {
  amount_cents: number;
  paid_on: string;
  bill_label: string;
  category_id: string | null;
}

/**
 * Reports are built on bill/debt payments and goal activity — the data the
 * app's existing screens actually populate — rather than the generic
 * `transactions` table, which has no entry screen yet and is empty for
 * every real user.
 */
export async function listBillPaymentsForReports(
  client: TypedSupabaseClient,
  userId: string,
  range?: DateRange
): Promise<BillPaymentForReport[]> {
  let query = client
    .from('bill_payments')
    .select('amount_cents, paid_on, bills(label, category_id)')
    .eq('user_id', userId);
  if (range?.fromDate) query = query.gte('paid_on', range.fromDate);
  if (range?.toDate) query = query.lte('paid_on', range.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => ({
    amount_cents: row.amount_cents,
    paid_on: row.paid_on,
    bill_label: row.bills?.label ?? 'Bill',
    category_id: row.bills?.category_id ?? null,
  }));
}

export interface DebtPaymentForReport {
  amount_cents: number;
  paid_on: string;
  debt_label: string;
}

export async function listDebtPaymentsForReports(
  client: TypedSupabaseClient,
  userId: string,
  range?: DateRange
): Promise<DebtPaymentForReport[]> {
  let query = client
    .from('debt_payments')
    .select('amount_cents, paid_on, debts(label)')
    .eq('user_id', userId);
  if (range?.fromDate) query = query.gte('paid_on', range.fromDate);
  if (range?.toDate) query = query.lte('paid_on', range.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => ({
    amount_cents: row.amount_cents,
    paid_on: row.paid_on,
    debt_label: row.debts?.label ?? 'Debt',
  }));
}

export interface GoalActivityForReport {
  amount_cents: number;
  occurred_on: string;
  kind: string;
  goal_label: string;
}

export async function listGoalActivityForReports(
  client: TypedSupabaseClient,
  userId: string,
  range?: DateRange
): Promise<GoalActivityForReport[]> {
  let query = client
    .from('goal_activity')
    .select('amount_cents, occurred_on, kind, savings_goals(label)')
    .eq('user_id', userId);
  if (range?.fromDate) query = query.gte('occurred_on', range.fromDate);
  if (range?.toDate) query = query.lte('occurred_on', range.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => ({
    amount_cents: row.amount_cents,
    occurred_on: row.occurred_on,
    kind: row.kind,
    goal_label: row.savings_goals?.label ?? 'Goal',
  }));
}
