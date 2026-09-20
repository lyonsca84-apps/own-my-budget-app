import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

export async function listSavingsGoals(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'savings_goals'>[]> {
  const { data, error } = await client
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function createSavingsGoal(
  client: TypedSupabaseClient,
  goal: TablesInsert<'savings_goals'>
): Promise<Tables<'savings_goals'>> {
  const { data, error } = await client.from('savings_goals').insert(goal).select().single();
  if (error) throw error;
  return data;
}

export async function listGoalActivity(
  client: TypedSupabaseClient,
  goalId: string
): Promise<Tables<'goal_activity'>[]> {
  const { data, error } = await client
    .from('goal_activity')
    .select('*')
    .eq('goal_id', goalId)
    .order('occurred_on', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Records a deposit/withdrawal and updates the goal's running saved_cents
 * atomically, via the `record_goal_activity` Postgres function.
 *
 * `occurredOn` is required rather than defaulted here so this layer never
 * needs to know "today" — that's a packages/core (formatLocalDate) concern,
 * kept out of the data-access layer on purpose.
 */
export async function recordGoalActivity(
  client: TypedSupabaseClient,
  args: {
    goalId: string;
    amountCents: number;
    kind: 'deposit' | 'withdrawal';
    occurredOn: string;
    note?: string;
  }
): Promise<Tables<'goal_activity'>> {
  const { data, error } = await client.rpc('record_goal_activity', {
    p_goal_id: args.goalId,
    p_amount_cents: args.amountCents,
    p_kind: args.kind,
    p_note: args.note ?? '',
    p_occurred_on: args.occurredOn,
  });
  if (error) throw error;
  return data;
}

export async function createSavingsChallenge(
  client: TypedSupabaseClient,
  challenge: TablesInsert<'savings_challenges'>
): Promise<Tables<'savings_challenges'>> {
  const { data, error } = await client
    .from('savings_challenges')
    .insert(challenge)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSavingsGoal(
  client: TypedSupabaseClient,
  goalId: string,
  patch: TablesUpdate<'savings_goals'>
): Promise<Tables<'savings_goals'>> {
  const { data, error } = await client
    .from('savings_goals')
    .update(patch)
    .eq('id', goalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Soft-deletes a goal by stamping `archived_at` (listSavingsGoals already
 * filters archived goals out), so its deposit history is never destroyed.
 * `archivedAt` is passed in for the same reason `occurredOn` is above.
 */
export async function archiveSavingsGoal(
  client: TypedSupabaseClient,
  goalId: string,
  archivedAt: string
): Promise<void> {
  const { error } = await client
    .from('savings_goals')
    .update({ archived_at: archivedAt })
    .eq('id', goalId);
  if (error) throw error;
}

export async function listSavingsChallenges(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'savings_challenges'>[]> {
  const { data, error } = await client
    .from('savings_challenges')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

/** Every deposit/withdrawal across all of the user's goals, newest first — feeds the activity list, monthly stat and badges. */
export async function listUserGoalActivity(
  client: TypedSupabaseClient,
  userId: string,
  limit = 500
): Promise<Tables<'goal_activity'>[]> {
  const { data, error } = await client
    .from('goal_activity')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export interface SavingsInsightSignals {
  hasBudgetPlan: boolean;
  /** Active bills that recur within a month (or fall due in it). */
  billsTotal: number;
  /** ...of which already have a payment recorded this month. */
  billsPaid: number;
  hasPaidOffDebt: boolean;
  hasAssignedPaycheck: boolean;
  /** Distinct days with a (non-deleted) transaction since `trackingSince`. */
  trackedDays: number;
}

/**
 * The cross-feature facts the Savings badges and missions depend on (budget
 * built, bills paid, debt paid off, paycheck assigned, expenses tracked).
 * Date boundaries are supplied by the caller — this layer never reads "now".
 */
export async function getSavingsInsightSignals(
  client: TypedSupabaseClient,
  userId: string,
  range: { monthStart: string; nextMonthStart: string; trackingSince: string }
): Promise<SavingsInsightSignals> {
  const [budget, bills, payments, paidOffDebts, assigned, transactions] = await Promise.all([
    client
      .from('budget_lines')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('planned_cents', 0),
    client
      .from('bills')
      .select('id, due_date, recurrence')
      .eq('user_id', userId)
      .is('archived_at', null),
    client
      .from('bill_payments')
      .select('bill_id')
      .eq('user_id', userId)
      .gte('paid_on', range.monthStart)
      .lt('paid_on', range.nextMonthStart),
    client.from('debts').select('id').eq('user_id', userId).lte('balance_cents', 0),
    client
      .from('paychecks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_assigned', true),
    client
      .from('transactions')
      .select('occurred_on')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('occurred_on', range.trackingSince),
  ]);
  for (const result of [budget, bills, payments, paidOffDebts, assigned, transactions]) {
    if (result.error) throw result.error;
  }

  const paidBillIds = new Set((payments.data ?? []).map((p) => p.bill_id));
  const relevantBills = (bills.data ?? []).filter(
    (bill) =>
      ['monthly', 'weekly', 'biweekly'].includes(bill.recurrence) ||
      (bill.due_date >= range.monthStart && bill.due_date < range.nextMonthStart)
  );

  // A zero balance only means "paid off" if payments were actually made — a
  // debt entered at $0 shouldn't hand out the Debt Crusher badge.
  let hasPaidOffDebt = false;
  const zeroBalanceDebtIds = (paidOffDebts.data ?? []).map((d) => d.id);
  if (zeroBalanceDebtIds.length > 0) {
    const { count, error } = await client
      .from('debt_payments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('debt_id', zeroBalanceDebtIds);
    if (error) throw error;
    hasPaidOffDebt = (count ?? 0) > 0;
  }

  return {
    hasBudgetPlan: (budget.count ?? 0) > 0,
    billsTotal: relevantBills.length,
    billsPaid: relevantBills.filter((bill) => paidBillIds.has(bill.id)).length,
    hasPaidOffDebt,
    hasAssignedPaycheck: (assigned.count ?? 0) > 0,
    trackedDays: new Set((transactions.data ?? []).map((t) => t.occurred_on)).size,
  };
}

export async function getSavingsGoal(
  client: TypedSupabaseClient,
  goalId: string
): Promise<Tables<'savings_goals'>> {
  const { data, error } = await client.from('savings_goals').select('*').eq('id', goalId).single();
  if (error) throw error;
  return data;
}
