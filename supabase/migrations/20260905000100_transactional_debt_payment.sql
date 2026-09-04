-- Recording a debt payment touches two rows (insert the payment, decrement
-- the debt's running balance) that must never be allowed to happen only
-- half-way. SECURITY INVOKER (the default) means this still runs as the
-- calling user, so the existing RLS policies on both tables apply exactly
-- as if the two statements were run separately — this function only adds
-- atomicity, not privilege.
create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount_cents bigint,
  p_paid_on date
)
returns public.debt_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.debt_payments;
begin
  insert into public.debt_payments (user_id, debt_id, amount_cents, paid_on)
  values ((select auth.uid()), p_debt_id, p_amount_cents, p_paid_on)
  returning * into v_payment;

  update public.debts
  set balance_cents = greatest(balance_cents - p_amount_cents, 0)
  where id = p_debt_id;

  return v_payment;
end;
$$;

-- Same atomicity concern for savings: a deposit/withdrawal must never be
-- recorded without the goal's running saved_cents total moving with it.
create or replace function public.record_goal_activity(
  p_goal_id uuid,
  p_amount_cents bigint,
  p_kind text,
  p_note text,
  p_occurred_on date
)
returns public.goal_activity
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_activity public.goal_activity;
  v_delta bigint;
begin
  if p_kind not in ('deposit', 'withdrawal') then
    raise exception 'record_goal_activity: kind must be deposit or withdrawal, got %', p_kind;
  end if;

  insert into public.goal_activity (user_id, goal_id, amount_cents, kind, note, occurred_on)
  values ((select auth.uid()), p_goal_id, p_amount_cents, p_kind, p_note, coalesce(p_occurred_on, current_date))
  returning * into v_activity;

  v_delta := case when p_kind = 'deposit' then p_amount_cents else -p_amount_cents end;

  update public.savings_goals
  set saved_cents = greatest(saved_cents + v_delta, 0)
  where id = p_goal_id;

  return v_activity;
end;
$$;
