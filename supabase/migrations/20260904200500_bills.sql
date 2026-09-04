-- Bill status (paid/upcoming/overdue) is derived from due_date + payment
-- history in packages/core, not stored — avoids a second source of truth.

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  label text not null,
  amount_cents bigint not null,
  due_date date not null,
  recurrence text not null default 'monthly'
    check (recurrence in ('none', 'weekly', 'biweekly', 'monthly', 'yearly')),
  autopay boolean not null default false,
  reminder_days_before smallint not null default 3,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bills_user_id_idx on public.bills (user_id);
create index bills_due_date_idx on public.bills (user_id, due_date);

create trigger set_bills_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

alter table public.bills enable row level security;

create policy "bills_all_own" on public.bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  amount_cents bigint not null,
  paid_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bill_payments_user_id_idx on public.bill_payments (user_id);
create index bill_payments_bill_id_idx on public.bill_payments (bill_id);

create trigger set_bill_payments_updated_at
  before update on public.bill_payments
  for each row execute function public.set_updated_at();

alter table public.bill_payments enable row level security;

create policy "bill_payments_all_own" on public.bill_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
