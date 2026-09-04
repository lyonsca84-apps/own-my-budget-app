create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  target_cents bigint not null,
  saved_cents bigint not null default 0,
  target_date date,
  is_challenge boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index savings_goals_user_id_idx on public.savings_goals (user_id);

create trigger set_savings_goals_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

create policy "savings_goals_all_own" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.goal_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount_cents bigint not null,
  kind text not null default 'deposit' check (kind in ('deposit', 'withdrawal')),
  note text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index goal_activity_user_id_idx on public.goal_activity (user_id);
create index goal_activity_goal_id_idx on public.goal_activity (goal_id);

alter table public.goal_activity enable row level security;

create policy "goal_activity_all_own" on public.goal_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 52-week challenge (PLAN.md screens #41-42) is modeled as a special goal
-- type, sharing progress tracking and deposits with regular goals.
create table public.savings_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid references public.savings_goals (id) on delete cascade,
  challenge_type text not null default 'classic_ascending'
    check (challenge_type in ('classic_ascending', 'flat', 'reverse', 'custom')),
  cadence text not null default 'weekly' check (cadence in ('weekly', 'biweekly')),
  total_weeks smallint not null default 52,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index savings_challenges_user_id_idx on public.savings_challenges (user_id);

create trigger set_savings_challenges_updated_at
  before update on public.savings_challenges
  for each row execute function public.set_updated_at();

alter table public.savings_challenges enable row level security;

create policy "savings_challenges_all_own" on public.savings_challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
