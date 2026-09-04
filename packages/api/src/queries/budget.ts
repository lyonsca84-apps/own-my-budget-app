import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export async function getOrCreateBudgetPeriod(
  client: TypedSupabaseClient,
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<Tables<'budget_periods'>> {
  const existing = await client
    .from('budget_periods')
    .select('*')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await client
    .from('budget_periods')
    .insert({ user_id: userId, period_start: periodStart, period_end: periodEnd })
    .select()
    .single();
  if (created.error) throw created.error;
  return created.data;
}

export async function listBudgetLines(
  client: TypedSupabaseClient,
  budgetPeriodId: string
): Promise<Tables<'budget_lines'>[]> {
  const { data, error } = await client
    .from('budget_lines')
    .select('*')
    .eq('budget_period_id', budgetPeriodId);
  if (error) throw error;
  return data;
}

export async function upsertBudgetLine(
  client: TypedSupabaseClient,
  budgetLine: TablesInsert<'budget_lines'>
): Promise<Tables<'budget_lines'>> {
  const { data, error } = await client
    .from('budget_lines')
    .upsert(budgetLine, { onConflict: 'budget_period_id,category_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
