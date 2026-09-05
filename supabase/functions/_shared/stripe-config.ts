// Single source of truth for which Stripe Price ID maps to which plan
// tier, in both directions — never hardcode a Price ID anywhere else, and
// never let a client tell us a raw Price ID directly (see
// getPlanPriceId's doc comment). Price IDs are environment-specific (test
// vs. live, and differ per Stripe account), so they're read from Edge
// Function secrets rather than committed to source, the same discipline as
// the AI model IDs in ai-config.ts.
import Stripe from 'npm:stripe@22.6.1';

import type { PlanTier } from './feature-limits.ts';

export type PaidPlanTier = Exclude<PlanTier, 'free'>;
export type BillingInterval = 'monthly' | 'yearly';

export interface PriceMapping {
  planTier: PaidPlanTier;
  /** Only Budget Buddy prices get the 14-day trial — see PLAN.md §5. */
  trialDays?: number;
}

function envKeyFor(planTier: PaidPlanTier, interval: BillingInterval): string {
  const planPart = planTier === 'guided' ? 'GUIDED' : 'BUDGETBUDDY';
  const intervalPart = interval === 'monthly' ? 'MONTHLY' : 'YEARLY';
  return `STRIPE_PRICE_${planPart}_${intervalPart}`;
}

/**
 * The client picks a plan tier + billing interval, never a raw Price ID —
 * this is the only place that turns that choice into an actual Stripe
 * Price ID, server-side. That keeps a client from ever being able to name
 * an arbitrary Price ID (e.g. a live-mode price, or one we don't intend to
 * sell this way).
 */
export function getPlanPriceId(
  planTier: PaidPlanTier,
  interval: BillingInterval
): (PriceMapping & { priceId: string }) | null {
  const priceId = Deno.env.get(envKeyFor(planTier, interval));
  if (!priceId) return null;
  return { priceId, planTier, trialDays: planTier === 'budgetBuddy' ? 14 : undefined };
}

/** The reverse direction — used by the webhook to map a Stripe subscription's price back to our plan tier. */
export function getPriceToPlanMap(): Record<string, PriceMapping> {
  const map: Record<string, PriceMapping> = {};
  for (const planTier of ['guided', 'budgetBuddy'] as const) {
    for (const interval of ['monthly', 'yearly'] as const) {
      const mapping = getPlanPriceId(planTier, interval);
      if (mapping)
        map[mapping.priceId] = { planTier: mapping.planTier, trialDays: mapping.trialDays };
    }
  }
  return map;
}

export function createStripeClient(): Stripe {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY in the function environment.');
  }
  return new Stripe(secretKey);
}
