-- Extensions
create extension if not exists pgcrypto with schema extensions;

-- Shared updated_at trigger function, reused by every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: one row per auth user, created automatically on signup.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'there',
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
-- No insert/delete policy: profiles are created by handle_new_user() and
-- deleted via the auth.users cascade, never directly by the client.

-- user_settings: presentation preferences only. Plan tier lives in
-- `entitlements` (a later migration), never here — this table must never
-- become a second source of truth for what a user is entitled to.
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);

-- notification_preferences: per PLAN.md screen #67.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bill_reminders_enabled boolean not null default true,
  bill_reminder_days_before smallint not null default 3,
  payday_reminders_enabled boolean not null default true,
  goal_milestone_alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id);

-- Auto-provision profile + settings rows the moment someone signs up, so the
-- app never has to handle a "no profile yet" state after auth succeeds.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
