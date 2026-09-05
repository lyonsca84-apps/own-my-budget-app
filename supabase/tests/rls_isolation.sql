-- RLS isolation regression test. Requires supabase/seed.sql's two test
-- users (test-user-a / test-user-b) to already exist. Run the whole file
-- against the project via execute_sql or `psql -f`; every check RAISEs an
-- exception on failure, so a silent, clean run is a pass. Wrapped in a
-- transaction that's always rolled back — this test never leaves data behind.

begin;

-- ---------- User A sees exactly their own rows ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
declare
  n int;
begin
  select count(*) into n from public.accounts; if n <> 1 then raise exception 'FAIL: user A should see exactly 1 account, saw %', n; end if;
  select count(*) into n from public.bills; if n <> 1 then raise exception 'FAIL: user A should see exactly 1 bill, saw %', n; end if;
  select count(*) into n from public.debts; if n <> 1 then raise exception 'FAIL: user A should see exactly 1 debt, saw %', n; end if;
  select count(*) into n from public.savings_goals; if n <> 1 then raise exception 'FAIL: user A should see exactly 1 savings goal, saw %', n; end if;
  select count(*) into n from public.profiles; if n <> 1 then raise exception 'FAIL: user A should see exactly 1 profile, saw %', n; end if;

  select count(*) into n from public.bills where label = 'B - Rent';
  if n <> 0 then raise exception 'FAIL: user A must not see user B''s bill'; end if;
end $$;

-- entitlements: client cannot self-upgrade even their own row.
update public.entitlements set plan_tier = 'budgetBuddy' where user_id = 'a0000000-0000-0000-0000-00000000000a';
do $$
declare
  tier text;
begin
  select plan_tier into tier from public.entitlements where user_id = 'a0000000-0000-0000-0000-00000000000a';
  if tier <> 'free' then raise exception 'FAIL: client-side entitlements update should have been silently rejected by RLS, got %', tier; end if;
end $$;

-- Cross-user update: 0 rows affected because the row isn't even visible.
update public.bills set amount_cents = 1 where label = 'B - Rent';
do $$
declare
  n int;
begin
  select count(*) into n from public.bills where label = 'B - Rent' and amount_cents = 1;
  if n <> 0 then raise exception 'FAIL: user A must not be able to modify user B''s bill'; end if;
end $$;

-- Impersonation: inserting a row claiming to belong to user B must fail outright.
do $$
begin
  begin
    insert into public.accounts (user_id, label, balance_cents)
    values ('b0000000-0000-0000-0000-00000000000b', 'Impersonation Attempt', 999999);
    raise exception 'FAIL: insert with a spoofed user_id should have been rejected by RLS';
  exception
    when insufficient_privilege then
      null; -- expected
  end;
end $$;

-- ---------- Phase 6: receipts, pantry scans, groceries, feature_usage ----------
-- No seed data for these tables, so user A inserts its own rows here (inside
-- the same rolled-back transaction) rather than relying on supabase/seed.sql.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
declare
  v_receipt_id uuid;
  v_list_id uuid;
begin
  insert into public.receipts (user_id, store_label, ai_extraction_status)
  values ('a0000000-0000-0000-0000-00000000000a', 'A - Grocery Co', 'confirmed')
  returning id into v_receipt_id;

  insert into public.receipt_items (user_id, receipt_id, label, price_cents)
  values ('a0000000-0000-0000-0000-00000000000a', v_receipt_id, 'Test item', 500);

  insert into public.pantry_scans (user_id, ai_extraction_status)
  values ('a0000000-0000-0000-0000-00000000000a', 'confirmed');

  insert into public.grocery_lists (user_id, label)
  values ('a0000000-0000-0000-0000-00000000000a', 'A - List')
  returning id into v_list_id;

  insert into public.grocery_items (user_id, grocery_list_id, label)
  values ('a0000000-0000-0000-0000-00000000000a', v_list_id, 'Milk');
end $$;

-- A client cannot write feature_usage directly (no insert policy for
-- `authenticated` — only a service-role Edge Function may, per
-- supabase/migrations/20260904201000 and 20260905010000). RLS with no
-- matching policy denies the write outright.
do $$
begin
  begin
    insert into public.feature_usage (user_id, feature_key, period_start, used_count)
    values ('a0000000-0000-0000-0000-00000000000a', 'receiptScan', '1970-01-01', 999);
    raise exception 'FAIL: a client should never be able to write feature_usage directly';
  exception
    when insufficient_privilege then
      null; -- expected
  end;
end $$;

-- ---------- User B sees exactly their own rows ----------
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

do $$
declare
  n int;
begin
  select count(*) into n from public.receipts; if n <> 0 then raise exception 'FAIL: user B must not see user A''s receipts, saw %', n; end if;
  select count(*) into n from public.receipt_items; if n <> 0 then raise exception 'FAIL: user B must not see user A''s receipt items, saw %', n; end if;
  select count(*) into n from public.pantry_scans; if n <> 0 then raise exception 'FAIL: user B must not see user A''s pantry scans, saw %', n; end if;
  select count(*) into n from public.grocery_lists; if n <> 0 then raise exception 'FAIL: user B must not see user A''s grocery lists, saw %', n; end if;
  select count(*) into n from public.grocery_items; if n <> 0 then raise exception 'FAIL: user B must not see user A''s grocery items, saw %', n; end if;
end $$;

do $$
declare
  n int;
begin
  select count(*) into n from public.accounts; if n <> 1 then raise exception 'FAIL: user B should see exactly 1 account, saw %', n; end if;
  select count(*) into n from public.bills; if n <> 1 then raise exception 'FAIL: user B should see exactly 1 bill, saw %', n; end if;

  select count(*) into n from public.accounts where label = 'A - Checking';
  if n <> 0 then raise exception 'FAIL: user B must not see user A''s account'; end if;
end $$;

-- ---------- Anonymous (unauthenticated) sees nothing ----------
-- request.jwt.claims is a separate GUC from role and does NOT get cleared
-- by `set local role` — it must be reset explicitly, or this check would
-- silently keep evaluating auth.uid() as the previous (authenticated) user
-- and pass for the wrong reason. This exact mistake failed this test once.
set local role anon;
set local request.jwt.claims = '{}';

do $$
declare
  n int;
begin
  select count(*) into n from public.accounts; if n <> 0 then raise exception 'FAIL: anon should see 0 accounts, saw %', n; end if;
  select count(*) into n from public.profiles; if n <> 0 then raise exception 'FAIL: anon should see 0 profiles, saw %', n; end if;
  select count(*) into n from public.missions; if n <> 0 then raise exception 'FAIL: anon should see 0 missions (authenticated-only), saw %', n; end if;
end $$;

rollback;

select 'RLS isolation test: all checks passed' as result;
