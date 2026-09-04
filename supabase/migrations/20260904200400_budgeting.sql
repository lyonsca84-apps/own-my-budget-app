create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  rollover_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index budget_periods_user_id_idx on public.budget_periods (user_id);

create trigger set_budget_periods_updated_at
  before update on public.budget_periods
  for each row execute function public.set_updated_at();

alter table public.budget_periods enable row level security;

create policy "budget_periods_all_own" on public.budget_periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null default 'other'
    check (type in ('bill', 'groceries', 'savings', 'debt', 'allowance', 'other')),
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "categories_all_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  budget_period_id uuid not null references public.budget_periods (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  planned_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_period_id, category_id)
);

create index budget_lines_user_id_idx on public.budget_lines (user_id);
create index budget_lines_period_idx on public.budget_lines (budget_period_id);

create trigger set_budget_lines_updated_at
  before update on public.budget_lines
  for each row execute function public.set_updated_at();

alter table public.budget_lines enable row level security;

create policy "budget_lines_all_own" on public.budget_lines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  amount_cents bigint not null,
  occurred_on date not null,
  label text not null,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_occurred_on_idx on public.transactions (user_id, occurred_on);

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_all_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
