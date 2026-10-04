// Deno Edge Functions can't import from packages/core (a separate npm
// workspace, not deployed with the function bundle), so the limits actually
// enforced server-side are duplicated here from packages/core/src/resources.ts.
// packages/core's FEATURE_REGISTRY remains the source of truth for UI display
// (upgrade prompts, usage meters) — if you change a limit there, change it
// here too, for exactly these three AI-metered keys.
export type PlanTier = 'free' | 'guided' | 'budgetBuddy';
export type MeteredFeatureKey =
  'receiptScan' | 'pantryScan' | 'budgetBuddyAction' | 'jevDecision' | 'aiOrchestration';

export interface CountLimit {
  limit: number;
  period: 'monthly' | 'lifetime';
}

export const AI_FEATURE_LIMITS: Record<MeteredFeatureKey, Record<PlanTier, CountLimit>> = {
  receiptScan: {
    free: { limit: 2, period: 'lifetime' },
    guided: { limit: 5, period: 'monthly' },
    budgetBuddy: { limit: 30, period: 'monthly' },
  },
  pantryScan: {
    free: { limit: 1, period: 'lifetime' },
    guided: { limit: 2, period: 'monthly' },
    budgetBuddy: { limit: 15, period: 'monthly' },
  },
  budgetBuddyAction: {
    free: { limit: 3, period: 'lifetime' },
    guided: { limit: 20, period: 'monthly' },
    budgetBuddy: { limit: 150, period: 'monthly' },
  },
  // Jev decisions are cheap, fast classifications (not prose generation),
  // so these allowances are generous relative to budgetBuddyAction — but
  // still metered, per the "no AI action is ever literally unlimited" rule.
  // Conservative initial numbers; revisit once real usage is observed.
  jevDecision: {
    free: { limit: 30, period: 'monthly' },
    guided: { limit: 150, period: 'monthly' },
    budgetBuddy: { limit: 600, period: 'monthly' },
  },
  // One complex-task orchestration RUN (up to AI_ORCHESTRATOR_MAX_LOOPS
  // Claude calls each) — metered separately from jevDecision since it's a
  // Claude cost, not a Jev one. A run is only counted once it completes
  // with at least one real Claude call, never on a request that fails
  // before reaching Claude (see ai-orchestrate/index.ts).
  aiOrchestration: {
    free: { limit: 5, period: 'monthly' },
    guided: { limit: 30, period: 'monthly' },
    budgetBuddy: { limit: 100, period: 'monthly' },
  },
};
