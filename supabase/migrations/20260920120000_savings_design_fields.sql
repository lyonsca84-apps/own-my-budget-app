-- Savings & Goals redesign: the approved design tracks more per goal than the
-- original schema held (category, deposit plan, colour, notes, start date,
-- pausing), lets the 52-week challenge run at a $N multiplier with notes per
-- 5-week block, and lets a person edit or delete an individual deposit.
-- Everything here is additive and nullable (or defaulted), so existing rows and
-- the existing record_goal_activity function keep working unchanged. The
-- "Assigned to paycheck" line and "Plan payment" reuse payday_assignments from
-- 20260920100000_budget_paydays.sql — no separate table.

-- ---------------------------------------------------------- savings_goals
alter table public.savings_goals
  add column category text,
  add column frequency text not null default 'monthly'
    check (frequency in ('weekly', 'biweekly', 'monthly')),
  add column start_date date,
  add column planned_deposit_cents bigint
    check (planned_deposit_cents is null or planned_deposit_cents >= 0),
  add column account_label text,
  -- A key from the app's five-swatch goal palette; the app validates it.
  add column color text,
  add column notes text,
  -- Set while the goal is paused; a paused goal keeps its history and balance.
  add column paused_at timestamptz;

-- ------------------------------------------------------ savings_challenges
alter table public.savings_challenges
  -- Each week's deposit is week number x multiplier dollars ($1, $2, $5, $10...).
  add column multiplier numeric not null default 1 check (multiplier > 0),
  add column start_date date,
  add column notes text,
  -- Notes typed under each 5-week block, keyed by block number ("1", "2", ...).
  add column block_notes jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------ goal_activity
-- Which challenge week a deposit covers (null for ordinary deposits).
alter table public.goal_activity
  add column challenge_week smallint
    check (challenge_week is null or challenge_week > 0);

-- Editing or deleting a deposit must move the goal's running saved_cents with
-- it, atomically — the same reason record_goal_activity exists. security
-- invoker means RLS still limits every row touched to its owner.
create or replace function public.update_goal_activity(
  p_activity_id uuid,
  p_amount_cents bigint,
  p_occurred_on date,
  p_note text
)
returns public.goal_activity
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.goal_activity;
  v_new public.goal_activity;
  v_delta bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'update_goal_activity: amount must be greater than zero';
  end if;

  select * into v_old from public.goal_activity where id = p_activity_id for update;
  if not found then
    raise exception 'update_goal_activity: activity % not found', p_activity_id;
  end if;

  update public.goal_activity
  set amount_cents = p_amount_cents,
      occurred_on = coalesce(p_occurred_on, occurred_on),
      note = p_note
  where id = p_activity_id
  returning * into v_new;

  v_delta := (p_amount_cents - v_old.amount_cents)
    * case when v_old.kind = 'deposit' then 1 else -1 end;

  update public.savings_goals
  set saved_cents = greatest(saved_cents + v_delta, 0)
  where id = v_old.goal_id;

  return v_new;
end;
$$;

create or replace function public.delete_goal_activity(p_activity_id uuid)
returns public.goal_activity
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.goal_activity;
  v_delta bigint;
begin
  delete from public.goal_activity where id = p_activity_id returning * into v_old;
  if not found then
    raise exception 'delete_goal_activity: activity % not found', p_activity_id;
  end if;

  -- Reverse the row's effect on the goal's balance.
  v_delta := case when v_old.kind = 'deposit' then -v_old.amount_cents else v_old.amount_cents end;

  update public.savings_goals
  set saved_cents = greatest(saved_cents + v_delta, 0)
  where id = v_old.goal_id;

  return v_old;
end;
$$;

-- Logs one week of a 52-week challenge as a deposit tagged with its week.
-- Refuses a week that already has a deposit so double-taps can't double-count.
create or replace function public.record_challenge_week(
  p_goal_id uuid,
  p_week integer,
  p_amount_cents bigint,
  p_occurred_on date
)
returns public.goal_activity
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_activity public.goal_activity;
begin
  if p_week is null or p_week <= 0 then
    raise exception 'record_challenge_week: week must be positive, got %', p_week;
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'record_challenge_week: amount must be greater than zero';
  end if;
  if exists (
    select 1 from public.goal_activity
    where goal_id = p_goal_id and challenge_week = p_week
  ) then
    raise exception 'record_challenge_week: week % is already recorded', p_week;
  end if;

  insert into public.goal_activity
    (user_id, goal_id, amount_cents, kind, note, occurred_on, challenge_week)
  values
    ((select auth.uid()), p_goal_id, p_amount_cents, 'deposit', 'Week ' || p_week,
     coalesce(p_occurred_on, current_date), p_week::smallint)
  returning * into v_activity;

  update public.savings_goals
  set saved_cents = saved_cents + p_amount_cents
  where id = p_goal_id;

  return v_activity;
end;
$$;

-- Same lock-down as the other functions (see 20260904201300_harden_functions).
revoke execute on function public.update_goal_activity(uuid, bigint, date, text) from public, anon;
revoke execute on function public.delete_goal_activity(uuid) from public, anon;
revoke execute on function public.record_challenge_week(uuid, integer, bigint, date) from public, anon;
grant execute on function public.update_goal_activity(uuid, bigint, date, text) to authenticated;
grant execute on function public.delete_goal_activity(uuid) to authenticated;
grant execute on function public.record_challenge_week(uuid, integer, bigint, date) to authenticated;
