-- missions is a shared catalog table (not user-owned) — readable by every
-- authenticated user, writable only by the service role (no insert/update/
-- delete policy is granted to `authenticated` at all).
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  age_group text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy "missions_select_active_for_authenticated" on public.missions
  for select to authenticated using (is_active);

create table public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_missions_user_id_idx on public.user_missions (user_id);

create trigger set_user_missions_updated_at
  before update on public.user_missions
  for each row execute function public.set_updated_at();

alter table public.user_missions enable row level security;

create policy "user_missions_all_own" on public.user_missions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
