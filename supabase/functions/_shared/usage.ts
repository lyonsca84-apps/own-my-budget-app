import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { AI_FEATURE_LIMITS, type MeteredFeatureKey, type PlanTier } from './feature-limits.ts';

export class UsageLimitError extends Error {
  constructor(
    public readonly limit: number,
    public readonly period: 'monthly' | 'lifetime'
  ) {
    super(`Usage limit reached (${limit} per ${period}).`);
  }
}

/**
 * 'monthly' resets on the calendar month; 'lifetime' uses a fixed sentinel
 * date so the same row is reused forever and the allowance never renews.
 */
function periodStartFor(period: 'monthly' | 'lifetime'): string {
  if (period === 'lifetime') return '1970-01-01';
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-01`;
}

/**
 * Throws UsageLimitError if the caller is already at or over their plan's
 * limit for this feature. Call this BEFORE the Claude request so an
 * over-limit call never reaches (and never costs) the Anthropic API.
 */
export async function assertUnderLimit(
  admin: SupabaseClient,
  userId: string,
  featureKey: MeteredFeatureKey,
  planTier: PlanTier
): Promise<void> {
  const { limit, period } = AI_FEATURE_LIMITS[featureKey][planTier];
  const periodStart = periodStartFor(period);

  const { data, error } = await admin
    .from('feature_usage')
    .select('used_count')
    .eq('user_id', userId)
    .eq('feature_key', featureKey)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (error) throw error;

  const used = data?.used_count ?? 0;
  if (used >= limit) {
    throw new UsageLimitError(limit, period);
  }
}

/** Call only after a successful Claude response — never on a failed call. */
export async function recordUsage(
  admin: SupabaseClient,
  userId: string,
  featureKey: MeteredFeatureKey,
  planTier: PlanTier
): Promise<void> {
  const { period } = AI_FEATURE_LIMITS[featureKey][planTier];
  const periodStart = periodStartFor(period);

  const { error } = await admin.rpc('increment_feature_usage', {
    p_user_id: userId,
    p_feature_key: featureKey,
    p_period_start: periodStart,
  });
  if (error) throw error;
}

/** Every user has an entitlements row from the signup trigger — see migration 20260904201000. */
export async function getPlanTier(admin: SupabaseClient, userId: string): Promise<PlanTier> {
  const { data, error } = await admin
    .from('entitlements')
    .select('plan_tier')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data.plan_tier as PlanTier;
}
