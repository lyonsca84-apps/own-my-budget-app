-- Widens feature_usage's feature_key CHECK constraint to allow 'jevDecision',
-- the new metered key for Jev (OpenRouter Decisions API) calls from the
-- AI orchestration layer — see supabase/functions/_shared/feature-limits.ts
-- and supabase/functions/intent-router/index.ts. Reuses the existing
-- feature_usage table/increment_feature_usage RPC rather than adding new
-- state, matching the AI_FEATURE_LIMITS pattern already used for
-- receiptScan/pantryScan/budgetBuddyAction.
--
-- Rollback: safe to revert (drop 'jevDecision' from the list again) as long
-- as no feature_usage row has been written with feature_key = 'jevDecision'
-- yet — true as long as JEV_ORCHESTRATOR_ENABLED / JEV_VOICE_ROUTING_ENABLED
-- stay off, since nothing calls assertUnderLimit/recordUsage with this key
-- otherwise.
alter table public.feature_usage
  drop constraint if exists feature_usage_feature_key_check;

alter table public.feature_usage
  add constraint feature_usage_feature_key_check
  check (feature_key in (
    'receiptScan', 'pantryScan', 'savingsGoal', 'mission',
    'budgetBuddyAction', 'advancedDebtScenarios', 'fullReports', 'householdSharing',
    'jevDecision'
  ));
