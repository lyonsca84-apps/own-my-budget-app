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

/**
 * Edits one deposit/withdrawal and moves the goal's saved_cents by the
 * difference, atomically, via the `update_goal_activity` Postgres function.
 */
export async function updateGoalActivity(
  client: TypedSupabaseClient,
  args: { activityId: string; amountCents: number; occurredOn: string; note?: string }
): Promise<Tables<'goal_activity'>> {
  const { data, error } = await client.rpc('update_goal_activity', {
    p_activity_id: args.activityId,
    p_amount_cents: args.amountCents,
    p_note: args.note ?? '',
    p_occurred_on: args.occurredOn,
  });
  if (error) throw error;
  return data;
}

/**
 * Deletes one deposit/withdrawal and reverses its effect on the goal's
 * saved_cents, atomically, via the `delete_goal_activity` Postgres function.
 */
export async function deleteGoalActivity(
  client: TypedSupabaseClient,
  activityId: string
): Promise<Tables<'goal_activity'>> {
  const { data, error } = await client.rpc('delete_goal_activity', {
    p_activity_id: activityId,
  });
  if (error) throw error;
  return data;
}

/**
 * Logs one week of a 52-week challenge as a deposit tagged with its week
 * (`record_challenge_week`). Rejects a week that is already recorded.
 */
export async function recordChallengeWeek(
  client: TypedSupabaseClient,
  args: { goalId: string; week: number; amountCents: number; occurredOn: string }
): Promise<Tables<'goal_activity'>> {
  const { data, error } = await client.rpc('record_challenge_week', {
    p_goal_id: args.goalId,
    p_week: args.week,
    p_amount_cents: args.amountCents,
    p_occurred_on: args.occurredOn,
  });
  if (error) throw error;
  return data;
}

export async function updateSavingsChallenge(
  client: TypedSupabaseClient,
  challengeId: string,
  patch: TablesUpdate<'savings_challenges'>
): Promise<Tables<'savings_challenges'>> {
  const { data, error } = await client
    .from('savings_challenges')
    .update(patch)
    .eq('id', challengeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * True for the error a database that has not had the savings design migration
 * (20260920120000) applied yet returns when a new column or function is used —
 * lets callers fall back to the original fields instead of failing.
 */
export function isMissingSavingsSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code === 'PGRST204' || code === 'PGRST202' || code === '42703' || code === '42883') {
    return true;
  }
  return /schema cache|does not exist|could not find/i.test(message ?? '');
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
  /** YYYY-MM-DD of the first planned budget line — when "Budget Builder" was earned. */
  budgetPlanSince: string | null;
  /** Active bills that recur within a month (or fall due in it). */
  billsTotal: number;
  /** ...of which already have a payment recorded this month. */
  billsPaid: number;
  hasPaidOffDebt: boolean;
  hasAssignedPaycheck: boolean;
  /** YYYY-MM-DD of the first assigned paycheck — when "Paycheck Planner" was earned. */
  assignedPaycheckSince: string | null;
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
      .select('created_at')
      .eq('user_id', userId)
      .gt('planned_cents', 0)
      .order('created_at')
      .limit(1),
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
      .select('created_at')
      .eq('user_id', userId)
      .eq('is_assigned', true)
      .order('created_at')
      .limit(1),
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
    hasBudgetPlan: (budget.data ?? []).length > 0,
    budgetPlanSince: budget.data?.[0]?.created_at?.slice(0, 10) ?? null,
    billsTotal: relevantBills.length,
    billsPaid: relevantBills.filter((bill) => paidBillIds.has(bill.id)).length,
    hasPaidOffDebt,
    hasAssignedPaycheck: (assigned.data ?? []).length > 0,
    assignedPaycheckSince: assigned.data?.[0]?.created_at?.slice(0, 10) ?? null,
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
