/**
 * Source of Truth registry for plan tiers and feature limits.
 *
 * This is the single place that defines what Free, Guided, and Budget Buddy
 * include. Nothing outside this file should hardcode a limit — screens, API
 * handlers, and background jobs all call `evaluateFeatureGate` (featureGate.ts)
 * against the definitions here.
 *
 * Pricing (confirmed): Free — $0. Guided — $5.99/mo or $49.99/yr. Budget Buddy —
 * $9.99/mo or $79.99/yr, 14-day free trial. Both paid tiers price below every
 * named competitor (YNAB, Monarch, Copilot, EveryDollar, PocketGuard, Goodbudget
 * all sit at $75-109/yr) by design — see the pricing research in the product
 * decisions log. Budget Buddy (the AI assistant) is the flagship reason to
 * upgrade; pantry scanning and Missions stay present at every tier but capped,
 * per product direction, so they support the app without being the headline.
 *
 * No tier gets literally unlimited AI usage, even Budget Buddy — every AI
 * action is metered server-side against the limits below, so a single account
 * can never create runaway cost.
 */

export type PlanTier = 'free' | 'guided' | 'budgetBuddy';

export const TIER_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  guided: 'Guided',
  budgetBuddy: 'Budget Buddy',
};

/** The next tier up from each plan, for upgrade prompts. `null` = already the top tier. */
export const NEXT_TIER: Record<PlanTier, PlanTier | null> = {
  free: 'guided',
  guided: 'budgetBuddy',
  budgetBuddy: null,
};

export type FeatureKey =
  | 'receiptScan'
  | 'pantryScan'
  | 'savingsGoal'
  | 'mission'
  | 'budgetBuddyAction'
  | 'advancedDebtScenarios'
  | 'fullReports'
  | 'householdSharing';

export type FeatureLimit =
  | { kind: 'unlimited' }
  | {
      kind: 'count';
      limit: number;
      /**
       * 'monthly' = usage resets on the account's monthly cycle (server-tracked).
       * 'lifetime' = a one-time allowance that never resets — this is how the
       * Free tier's AI-adjacent features work, so trying them costs nothing
       * indefinitely without ever becoming a recurring cost.
       * Omitted = not time-based at all; `currentUsage` is a live resource count
       * (e.g. active savings goals right now), not usage accumulated over a period.
       */
      period?: 'monthly' | 'lifetime';
    }
  | { kind: 'flag'; enabled: boolean };

export interface FeatureDefinition {
  /** Human-readable name, used in usage meters and upgrade prompts. */
  label: string;
  limits: Record<PlanTier, FeatureLimit>;
}

/**
 * The `feature_usage.period_start` value for a given limit period, computed
 * the same way the AI Edge Functions compute it server-side (see
 * supabase/functions/_shared/usage.ts) — UTC calendar month, not local. This
 * is the one deliberate exception to the app's "always use local dates"
 * rule: the server has no local timezone to anchor to, so the client must
 * match its UTC bucketing exactly, or a usage query near a month boundary
 * could read the wrong row.
 */
export function getUsagePeriodStart(
  period: 'monthly' | 'lifetime',
  now: Date = new Date()
): string {
  if (period === 'lifetime') return '1970-01-01';
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-01`;
}

export const FEATURE_REGISTRY: Record<FeatureKey, FeatureDefinition> = {
  receiptScan: {
    label: 'Receipt scans',
    limits: {
      free: { kind: 'count', limit: 2, period: 'lifetime' },
      guided: { kind: 'count', limit: 5, period: 'monthly' },
      budgetBuddy: { kind: 'count', limit: 30, period: 'monthly' },
    },
  },
  pantryScan: {
    label: 'Pantry scans',
    limits: {
      free: { kind: 'count', limit: 1, period: 'lifetime' },
      guided: { kind: 'count', limit: 2, period: 'monthly' },
      budgetBuddy: { kind: 'count', limit: 15, period: 'monthly' },
    },
  },
  savingsGoal: {
    label: 'Savings goals',
    limits: {
      // Not time-based — this caps how many *active* goals an account may
      // have at once, not usage over a period.
      free: { kind: 'count', limit: 2 },
      guided: { kind: 'unlimited' },
      budgetBuddy: { kind: 'unlimited' },
    },
  },
  mission: {
    label: 'Budget Missions',
    limits: {
      free: { kind: 'count', limit: 2, period: 'lifetime' },
      guided: { kind: 'count', limit: 5, period: 'monthly' },
      budgetBuddy: { kind: 'unlimited' },
    },
  },
  budgetBuddyAction: {
    label: 'Budget Buddy actions',
    limits: {
      // Free gets a small taste (a handful of total actions, never renewing)
      // rather than a hard "preview only" wall — matches "Budget Buddy is the
      // main upgrade reason" without making Free feel broken.
      free: { kind: 'count', limit: 3, period: 'lifetime' },
      guided: { kind: 'count', limit: 20, period: 'monthly' },
      // Generous, but still metered — never advertise this as "unlimited".
      budgetBuddy: { kind: 'count', limit: 150, period: 'monthly' },
    },
  },
  advancedDebtScenarios: {
    label: 'Advanced payoff scenarios & comparisons',
    limits: {
      // Every plan gets basic snowball/avalanche planning — this flag only
      // covers the side-by-side advanced comparison view.
      free: { kind: 'flag', enabled: false },
      guided: { kind: 'flag', enabled: false },
      budgetBuddy: { kind: 'flag', enabled: true },
    },
  },
  fullReports: {
    label: 'Full financial reports',
    limits: {
      free: { kind: 'flag', enabled: false },
      guided: { kind: 'flag', enabled: true },
      budgetBuddy: { kind: 'flag', enabled: true },
    },
  },
  householdSharing: {
    label: 'Household sharing',
    limits: {
      // Deferred out of v1 entirely (individuals-only launch) — disabled for
      // every tier for now. Wire this up for real once household sharing ships.
      free: { kind: 'flag', enabled: false },
      guided: { kind: 'flag', enabled: false },
      budgetBuddy: { kind: 'flag', enabled: false },
    },
  },
};
