create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  type text not null default 'creditCard'
    check (type in ('creditCard', 'autoLoan', 'mortgage', 'personalLoan', 'studentLoan', 'other')),
  balance_cents bigint not null,
  apr_basis_points integer not null default 0,
  minimum_payment_cents bigint not null default 0,
  credit_limit_cents bigint,
  due_day smallint,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debts_user_id_idx on public.debts (user_id);

create trigger set_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

create policy "debts_all_own" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount_cents bigint not null,
  paid_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debt_payments_user_id_idx on public.debt_payments (user_id);
create index debt_payments_debt_id_idx on public.debt_payments (debt_id);

create trigger set_debt_payments_updated_at
  before update on public.debt_payments
  for each row execute function public.set_updated_at();

alter table public.debt_payments enable row level security;

create policy "debt_payments_all_own" on public.debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.payoff_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  strategy text not null default 'avalanche' check (strategy in ('snowball', 'avalanche')),
  extra_monthly_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payoff_plans_user_id_idx on public.payoff_plans (user_id);

create trigger set_payoff_plans_updated_at
  before update on public.payoff_plans
  for each row execute function public.set_updated_at();

alter table public.payoff_plans enable row level security;

create policy "payoff_plans_all_own" on public.payoff_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
