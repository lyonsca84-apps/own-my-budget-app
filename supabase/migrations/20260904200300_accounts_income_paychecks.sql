-- household_id is nullable and unenforced by RLS for now (household sharing
-- isn't live) — present so a later migration can extend ownership rules
-- without restructuring these tables.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  label text not null,
  type text not null default 'checking' check (type in ('checking', 'savings', 'cash')),
  balance_cents bigint not null default 0,
  currency text not null default 'USD',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);

create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

create policy "accounts_all_own" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  amount_cents bigint not null,
  frequency text not null default 'biweekly'
    check (frequency in ('weekly', 'biweekly', 'twice_monthly', 'monthly', 'variable')),
  next_pay_date date,
  is_variable boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_sources_user_id_idx on public.income_sources (user_id);

create trigger set_income_sources_updated_at
  before update on public.income_sources
  for each row execute function public.set_updated_at();

alter table public.income_sources enable row level security;

create policy "income_sources_all_own" on public.income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.paychecks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  income_source_id uuid references public.income_sources (id) on delete set null,
  amount_cents bigint not null,
  pay_date date not null,
  is_assigned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index paychecks_user_id_idx on public.paychecks (user_id);

create trigger set_paychecks_updated_at
  before update on public.paychecks
  for each row execute function public.set_updated_at();

alter table public.paychecks enable row level security;

create policy "paychecks_all_own" on public.paychecks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
