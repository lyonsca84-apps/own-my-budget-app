// Plan copy for the website. Prices and every limit come from
// @own-my-budget/core (PLAN_PRICING / FEATURE_REGISTRY) — the same registry the
// app and Edge Functions enforce — so the site can't advertise a benefit the
// product doesn't actually give.
import {
  FEATURE_REGISTRY,
  PLAN_PRICING,
  TIER_LABELS,
  type FeatureKey,
  type FeatureLimit,
  type PlanTier,
} from '@own-my-budget/core';

export type Billing = 'monthly' | 'yearly';
export type PaidPlan = Exclude<PlanTier, 'free'>;

export const TIERS: PlanTier[] = ['free', 'guided', 'budgetBuddy'];
export const TRIAL_DAYS = PLAN_PRICING.budgetBuddy.trialDays ?? 14;

export function planLabel(tier: PlanTier): string {
  return TIER_LABELS[tier];
}

export function price(tier: PlanTier, billing: Billing): string {
  return tier === 'free' ? '$0' : PLAN_PRICING[tier][billing];
}

export function billNote(tier: PlanTier, billing: Billing): string {
  if (tier === 'free') return 'Free forever';
  return billing === 'yearly' ? `Billed ${price(tier, 'yearly')} once a year` : 'Billed monthly';
}

function limit(key: FeatureKey, tier: PlanTier): FeatureLimit {
  return FEATURE_REGISTRY[key].limits[tier];
}

/** Short table-cell wording for a registry limit. */
export function limitText(key: FeatureKey, tier: PlanTier): string {
  const l = limit(key, tier);
  if (l.kind === 'unlimited') return 'Unlimited';
  if (l.kind === 'flag') return l.enabled ? '✓' : '—';
  if (l.period === 'monthly') return `${l.limit} a month`;
  if (l.period === 'lifetime') return `${l.limit} to try`;
  return `Up to ${l.limit}`;
}

function count(key: FeatureKey, tier: PlanTier): number {
  const l = limit(key, tier);
  return l.kind === 'count' ? l.limit : 0;
}

export interface PlanCard {
  id: PlanTier;
  name: string;
  desc: string;
  cta: string;
  note: string;
  highlight: boolean;
  features: string[];
}

export const PLAN_CARDS: PlanCard[] = [
  {
    id: 'free',
    name: planLabel('free'),
    desc: 'A simple place to begin.',
    cta: 'Start Free',
    note: 'No credit card needed.',
    highlight: false,
    features: [
      'Income, bills and due dates',
      'Paycheck planning for any pay schedule',
      'Debt tracking and payoff methods',
      `Up to ${count('savingsGoal', 'free')} savings goals`,
      'Try Budget Buddy, Missions and photo scans',
    ],
  },
  {
    id: 'guided',
    name: planLabel('guided'),
    desc: 'Build a routine that works for you.',
    cta: 'Choose Guided',
    note: '',
    highlight: true,
    features: [
      'Everything in Free',
      'Unlimited savings goals',
      'Full progress reports',
      `${count('mission', 'guided')} Budget Missions a month`,
      `Budget Buddy: ${count('budgetBuddyAction', 'guided')} AI actions a month`,
      'Receipt and pantry photo scans',
    ],
  },
  {
    id: 'budgetBuddy',
    name: planLabel('budgetBuddy'),
    desc: 'Extra help when you need a next step.',
    cta: 'Choose Budget Buddy',
    note: 'AI and photo tools have usage limits.',
    highlight: false,
    features: [
      'Everything in Guided',
      `Budget Buddy: ${count('budgetBuddyAction', 'budgetBuddy')} AI actions a month`,
      'Full Budget Mission library',
      'Side-by-side payoff comparisons',
      'More receipt and pantry scans',
      `${TRIAL_DAYS}-day free trial`,
    ],
  },
];

export interface CompareRow {
  label: string;
  cells: [string, string, string];
}

const all = (v: string): [string, string, string] => [v, v, v];
const fromRegistry = (key: FeatureKey): [string, string, string] =>
  TIERS.map((t) => limitText(key, t)) as [string, string, string];

export const COMPARE_ROWS: CompareRow[] = [
  { label: 'Income, bills and due dates', cells: all('✓') },
  { label: 'Weekly, biweekly and monthly paycheck planning', cells: all('✓') },
  { label: 'Debt tracking with snowball and avalanche', cells: all('✓') },
  { label: 'Side-by-side payoff comparisons', cells: fromRegistry('advancedDebtScenarios') },
  { label: 'Savings goals', cells: fromRegistry('savingsGoal') },
  { label: 'Budget Missions', cells: fromRegistry('mission') },
  { label: 'Budget Buddy AI actions', cells: fromRegistry('budgetBuddyAction') },
  { label: 'Receipt scans', cells: fromRegistry('receiptScan') },
  { label: 'Pantry scans and meal ideas', cells: fromRegistry('pantryScan') },
  { label: 'Full progress reports', cells: fromRegistry('fullReports') },
  { label: 'CSV and JSON export', cells: all('✓') },
];

/** Usage meters shown in Plan & Billing (monthly allowances only). */
export const METERED: { key: FeatureKey; label: string }[] = [
  { key: 'budgetBuddyAction', label: 'Budget Buddy (AI actions)' },
  { key: 'receiptScan', label: 'Receipt scans' },
  { key: 'pantryScan', label: 'Pantry scans' },
  { key: 'mission', label: 'Budget Missions' },
];

// ---------------------------------------------------------------------------
// Plan intent: a signed-out visitor's plan choice survives sign-up/log-in via
// the query string (?plan=guided&billing=yearly) plus sessionStorage, as the
// design's "Website-to-app flow" specifies. Free skips checkout.

export interface PlanIntent {
  plan: PlanTier;
  billing: Billing;
}

const INTENT_KEY = 'omb.planIntent';

export function parsePlan(raw: string | null | undefined): PlanTier | null {
  if (raw === 'free' || raw === 'guided' || raw === 'budgetBuddy') return raw;
  if (raw === 'buddy') return 'budgetBuddy';
  return null;
}

export function parseBilling(raw: string | null | undefined): Billing {
  return raw === 'yearly' ? 'yearly' : 'monthly';
}

export function intentFromUrl(search = window.location.search): PlanIntent | null {
  const params = new URLSearchParams(search);
  const plan = parsePlan(params.get('plan'));
  return plan ? { plan, billing: parseBilling(params.get('billing')) } : null;
}

export function saveIntent(intent: PlanIntent | null): void {
  try {
    if (intent) sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    else sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // Private browsing can block storage; the query string still carries the intent.
  }
}

export function loadIntent(): PlanIntent | null {
  const fromUrl = intentFromUrl();
  if (fromUrl) return fromUrl;
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlanIntent>;
    const plan = parsePlan(parsed.plan);
    return plan ? { plan, billing: parseBilling(parsed.billing) } : null;
  } catch {
    return null;
  }
}

export function intentQuery(intent: PlanIntent): string {
  return `plan=${intent.plan}&billing=${intent.billing}`;
}

/** Where a paid-plan button sends someone: checkout review (which handles sign-in). */
export function checkoutHref(plan: PlanTier, billing: Billing): string {
  return plan === 'free' ? '/signup' : `/checkout?${intentQuery({ plan, billing })}`;
}
