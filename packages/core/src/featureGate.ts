import {
  FEATURE_REGISTRY,
  NEXT_TIER,
  TIER_LABELS,
  type FeatureKey,
  type PlanTier,
} from './resources';

export interface FeatureGateContext {
  plan: PlanTier;
  /**
   * Usage so far in the current period for 'count' features: total-ever for a
   * 'lifetime' feature, usage-since-reset for a 'monthly' one, or the current
   * live resource count for a feature with no period (e.g. active goals).
   * Required for 'count' features; ignored for 'unlimited' and 'flag' features.
   */
  currentUsage?: number;
}

export interface FeatureGateResult {
  allowed: boolean;
  kind: 'unlimited' | 'count' | 'flag';
  limit?: number;
  remaining?: number;
  /** Set when `allowed` is false — safe to show directly in an upgrade prompt. */
  reason?: string;
}

function upgradeCta(plan: PlanTier): string {
  const next = NEXT_TIER[plan];
  return next ? `Upgrade to ${TIER_LABELS[next]} for more.` : '';
}

/**
 * Evaluates whether a plan can use a feature right now, against the
 * Source of Truth registry in resources.ts. Callers never read plan
 * limits directly — this is the only function that should branch on them.
 */
export function evaluateFeatureGate(
  feature: FeatureKey,
  context: FeatureGateContext
): FeatureGateResult {
  const definition = FEATURE_REGISTRY[feature];
  if (!definition) {
    throw new Error(
      `evaluateFeatureGate: unknown feature "${feature}". Add it to FEATURE_REGISTRY in resources.ts first.`
    );
  }

  const limit = definition.limits[context.plan];

  switch (limit.kind) {
    case 'unlimited':
      return { allowed: true, kind: 'unlimited' };

    case 'flag':
      return {
        allowed: limit.enabled,
        kind: 'flag',
        reason: limit.enabled
          ? undefined
          : `${definition.label} requires ${
              NEXT_TIER[context.plan] ? TIER_LABELS[NEXT_TIER[context.plan]!] : 'a higher plan'
            }.`,
      };

    case 'count': {
      const used = context.currentUsage ?? 0;
      const remaining = Math.max(limit.limit - used, 0);
      const allowed = used < limit.limit;

      let reason: string | undefined;
      if (!allowed) {
        const label = definition.label.toLowerCase();
        const cta = upgradeCta(context.plan);
        if (limit.period === 'monthly') {
          reason = `You've used all ${limit.limit} ${label} this month.${cta ? ` ${cta}` : ' That resets next month.'}`;
        } else if (limit.period === 'lifetime') {
          reason = `You've used your free ${label}.${cta ? ` ${cta}` : ''}`;
        } else {
          reason = `You've reached the ${limit.limit}-${label.replace(/s$/, '')} limit for your plan.${cta ? ` ${cta}` : ''}`;
        }
      }

      return {
        allowed,
        kind: 'count',
        limit: limit.limit,
        remaining,
        reason,
      };
    }
  }
}
