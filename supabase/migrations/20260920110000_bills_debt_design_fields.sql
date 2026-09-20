-- Bills & Debt redesign: the approved design tracks more per card / loan than
-- the original schema held, lets the user turn reminders off per bill, and keep
-- a payoff goal. ("Plan payment" reuses payday_assignments from
-- 20260920100000_budget_paydays.sql — no separate table.)
-- Everything here is additive and nullable (or defaulted), so existing rows
-- and the existing record_debt_payment function keep working unchanged.

-- ---------------------------------------------------------------- bills
alter table public.bills
  add column reminder_enabled boolean not null default true;

-- ---------------------------------------------------------------- debts
-- 'heloc' joins the loan types the design filters on.
alter table public.debts drop constraint if exists debts_type_check;
alter table public.debts
  add constraint debts_type_check
  check (type in ('creditCard', 'autoLoan', 'mortgage', 'heloc', 'personalLoan', 'studentLoan', 'other'));

alter table public.debts
  add column original_balance_cents bigint,
  add column planned_payment_cents bigint,
  add column notes text,
  -- Credit-card presentation. card_style is a key from the app's card palette
  -- (a gradient preset or a solid brand color); the app validates it.
  add column issuer text,
  add column last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  add column network text,
  add column card_style text,
  add column card_text_mode text not null default 'auto'
    check (card_text_mode in ('auto', 'light', 'dark')),
  -- Promotional (e.g. 0%) balance on a card.
  add column promo_balance_cents bigint,
  add column promo_apr_basis_points integer,
  add column promo_expires_on date,
  -- Loan / mortgage details.
  add column lender text,
  add column term_months integer,
  add column started_on date;

-- ------------------------------------------------- payoff plan (goal + prefs)
alter table public.payoff_plans
  add column card_goal_target_cents bigint,
  add column card_goal_target_date date,
  add column card_goal_monthly_cents bigint;

-- One plan row per user so the app can upsert it.
create unique index payoff_plans_user_id_key on public.payoff_plans (user_id);
