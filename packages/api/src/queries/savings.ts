import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

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
