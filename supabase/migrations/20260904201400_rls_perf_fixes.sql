-- Performance advisor findings after the initial schema:
-- 1. Every policy wrote `auth.uid()` inline, which Postgres re-evaluates
--    per row instead of once per query. Wrapping it as `(select auth.uid())`
--    lets the planner treat it as a stable initplan value. Recreate every
--    affected policy with the wrapped form.
-- 2. A handful of foreign key columns were missing a covering index.

-- ---------- 1. RLS policy rewrites ----------

drop policy "notification_preferences_select_own" on public.notification_preferences;
drop policy "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_select_own" on public.notification_preferences
  for select using ((select auth.uid()) = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences
  for update using ((select auth.uid()) = user_id);

drop policy "profiles_select_own" on public.profiles;
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id);

drop policy "user_settings_select_own" on public.user_settings;
drop policy "user_settings_update_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using ((select auth.uid()) = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using ((select auth.uid()) = user_id);

drop policy "households_insert_self" on public.households;
drop policy "households_update_owner" on public.households;
create policy "households_insert_self" on public.households
  for insert with check (created_by = (select auth.uid()));
create policy "households_update_owner" on public.households
  for update using (
    exists (
      select 1 from public.household_members
      where household_id = id and user_id = (select auth.uid()) and role = 'owner'
    )
  );

drop policy "household_members_insert_owner" on public.household_members;
drop policy "household_members_delete_owner_or_self" on public.household_members;
create policy "household_members_insert_owner" on public.household_members
  for insert with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = (select auth.uid()) and hm.role = 'owner'
    )
  );
create policy "household_members_delete_owner_or_self" on public.household_members
  for delete using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = (select auth.uid()) and hm.role = 'owner'
    )
  );

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'income_sources', 'paychecks', 'budget_periods', 'categories',
    'budget_lines', 'transactions', 'debts', 'bills', 'bill_payments',
    'debt_payments', 'payoff_plans', 'savings_goals', 'goal_activity',
    'savings_challenges', 'receipts', 'receipt_items', 'pantry_scans',
    'grocery_lists', 'grocery_items', 'user_missions'
  ]
  loop
    execute format('drop policy %I on public.%I', t || '_all_own', t);
    execute format(
      'create policy %I on public.%I for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_all_own', t
    );
  end loop;
end $$;

drop policy "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using ((select auth.uid()) = user_id);

drop policy "feature_usage_select_own" on public.feature_usage;
create policy "feature_usage_select_own" on public.feature_usage
  for select using ((select auth.uid()) = user_id);

drop policy "audit_log_select_own" on public.audit_log;
create policy "audit_log_select_own" on public.audit_log
  for select using ((select auth.uid()) = user_id);

-- ---------- 2. Missing FK indexes ----------

create index accounts_household_id_idx on public.accounts (household_id);
create index bills_category_id_idx on public.bills (category_id);
create index budget_lines_category_id_idx on public.budget_lines (category_id);
create index household_members_user_id_idx on public.household_members (user_id);
create index households_created_by_idx on public.households (created_by);
create index paychecks_income_source_id_idx on public.paychecks (income_source_id);
create index savings_challenges_goal_id_idx on public.savings_challenges (goal_id);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index user_missions_mission_id_idx on public.user_missions (mission_id);
