-- Budget view support.
--
-- 1. budget_lines.actual_override_cents: lets a user type the "actual"
--    amount for a category directly in the Budget view. Null means "use the
--    amount tracked from payments/transactions"; a value replaces it for
--    that category and month.
--
-- 2. payday_assignments: plan which paycheck covers each bill, debt payment,
--    or savings contribution. A payday is identified by the pay schedule
--    (income_source_id) and its pay_date, because upcoming paydays are
--    projected from the schedule and may not have a paychecks row yet.
--    Planning never changes a balance; only recording a payment does.

alter table public.budget_lines
  add column actual_override_cents bigint check (actual_override_cents is null or actual_override_cents >= 0);

create table public.payday_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  income_source_id uuid not null references public.income_sources (id) on delete cascade,
  pay_date date not null,
  target_type text not null check (target_type in ('bill', 'debt', 'savings_goal')),
  target_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (income_source_id, pay_date, target_type, target_id)
);

create index payday_assignments_user_id_idx on public.payday_assignments (user_id);
create index payday_assignments_target_idx on public.payday_assignments (target_type, target_id);

create trigger set_payday_assignments_updated_at
  before update on public.payday_assignments
  for each row execute function public.set_updated_at();

alter table public.payday_assignments enable row level security;

create policy "payday_assignments_all_own" on public.payday_assignments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
