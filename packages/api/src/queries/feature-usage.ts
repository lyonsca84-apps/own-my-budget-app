import type { TypedSupabaseClient } from '../client';

/**
 * Reads the caller's own usage count for one feature/period (RLS limits
 * `authenticated` to SELECT on feature_usage — only a service-role Edge
 * Function may ever write it, see supabase/migrations/20260905010000).
 * `periodStart` should come from packages/core's `getUsagePeriodStart` so it
 * matches exactly what the server bucketed usage under.
 */
export async function getFeatureUsageCount(
  client: TypedSupabaseClient,
  userId: string,
  featureKey: string,
  periodStart: string
): Promise<number> {
  const { data, error } = await client
    .from('feature_usage')
    .select('used_count')
    .eq('user_id', userId)
    .eq('feature_key', featureKey)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (error) throw error;
  return data?.used_count ?? 0;
}
