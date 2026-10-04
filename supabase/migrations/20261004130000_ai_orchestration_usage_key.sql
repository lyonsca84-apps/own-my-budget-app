-- Widens feature_usage's feature_key CHECK constraint to allow
-- 'aiOrchestration', the new metered key for complex-task orchestration
-- runs (Claude -> tool -> Jev -> revise loop) — see
-- supabase/functions/_shared/feature-limits.ts and
-- supabase/functions/ai-orchestrate/index.ts. Reuses the existing
-- feature_usage table/increment_feature_usage RPC, same as the
-- 'jevDecision' key added in migration 20261004120000.
--
-- Rollback: safe to revert (drop 'aiOrchestration' from the list again) as
-- long as no feature_usage row has been written with that key yet — true
-- while JEV_ORCHESTRATOR_ENABLED stays off.
alter table public.feature_usage
  drop constraint if exists feature_usage_feature_key_check;

alter table public.feature_usage
  add constraint feature_usage_feature_key_check
  check (feature_key in (
    'receiptScan', 'pantryScan', 'savingsGoal', 'mission',
    'budgetBuddyAction', 'advancedDebtScenarios', 'fullReports', 'householdSharing',
    'jevDecision', 'aiOrchestration'
  ));
