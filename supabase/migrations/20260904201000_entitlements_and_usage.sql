-- entitlements is the single source of truth for plan tier (see
-- packages/core/src/resources.ts's PlanTier). No insert/update/delete policy
-- is granted to `authenticated` here — only a service-role server function
-- (Stripe/RevenueCat webhook handler) may ever change a user's plan. Client
-- code may only read its own row.
create table public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'guided', 'budgetBuddy')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  revenuecat_app_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_entitlements_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

alter table public.entitlements enable row level security;

create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = user_id);

-- Every new user starts on Free. Extend the same handle_new_user() trigger
-- from the profiles migration rather than adding a second auth.users trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;

-- feature_usage meters exactly the features in packages/core's FeatureKey
-- union. Select-only for the owner — only a service-role server function
-- may increment usage, so a client can never bypass its own limit.
create table public.feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature_key text not null
    check (feature_key in (
      'receiptScan', 'pantryScan', 'savingsGoal', 'mission',
      'budgetBuddyAction', 'advancedDebtScenarios', 'fullReports', 'householdSharing'
    )),
  -- The start of the period this row counts usage for. A 'lifetime' feature
  -- (see resources.ts) always uses the same fixed period_start (e.g. the
  -- account's signup date) so it never resets; a 'monthly' feature gets a
  -- new row each calendar month.
  period_start date not null,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key, period_start)
);

create index feature_usage_user_id_idx on public.feature_usage (user_id);

create trigger set_feature_usage_updated_at
  before update on public.feature_usage
  for each row execute function public.set_updated_at();

alter table public.feature_usage enable row level security;

create policy "feature_usage_select_own" on public.feature_usage
  for select using (auth.uid() = user_id);

-- Webhook idempotency: no RLS policy grants access to `authenticated` at
-- all, so only the service role (used by the webhook handler) can touch
-- this table. RLS is still enabled per the "every table" rule.
create table public.processed_webhook_events (
  id text primary key,
  source text not null check (source in ('stripe', 'revenuecat')),
  processed_at timestamptz not null default now()
);

alter table public.processed_webhook_events enable row level security;
