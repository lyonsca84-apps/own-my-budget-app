-- Seed data: two unrelated test users, each with a small set of owned rows,
-- so RLS isolation can be verified (a query as user A must never return
-- user B's rows). NOT for production — obviously-fake test accounts only.
-- Passwords are throwaway values; nobody should ever sign in as these users
-- outside of local/staging RLS testing.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
(
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-00000000000a',
  'authenticated', 'authenticated',
  'test-user-a@ownmybudget.test',
  crypt('Test-Password-A-1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
),
(
  '00000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-00000000000b',
  'authenticated', 'authenticated',
  'test-user-b@ownmybudget.test',
  crypt('Test-Password-B-1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);
-- The on_auth_user_created trigger fires here, creating each user's
-- profiles / user_settings / notification_preferences / entitlements rows.

update public.profiles set display_name = 'Test User A' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Test User B' where id = 'b0000000-0000-0000-0000-00000000000b';

-- A small owned dataset for User A.
insert into public.accounts (user_id, label, balance_cents)
values ('a0000000-0000-0000-0000-00000000000a', 'A - Checking', 150000);

insert into public.categories (id, user_id, name, type)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'A - Housing', 'bill');

insert into public.bills (user_id, category_id, label, amount_cents, due_date)
values ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'A - Rent', 140000, current_date + 5);

insert into public.debts (user_id, label, type, balance_cents, minimum_payment_cents)
values ('a0000000-0000-0000-0000-00000000000a', 'A - Visa', 'creditCard', 200000, 6000);

insert into public.savings_goals (user_id, label, target_cents, saved_cents)
values ('a0000000-0000-0000-0000-00000000000a', 'A - Emergency Fund', 300000, 50000);

-- The equivalent, separately-owned dataset for User B.
insert into public.accounts (user_id, label, balance_cents)
values ('b0000000-0000-0000-0000-00000000000b', 'B - Checking', 275000);

insert into public.categories (id, user_id, name, type)
values ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'B - Housing', 'bill');

insert into public.bills (user_id, category_id, label, amount_cents, due_date)
values ('b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'B - Rent', 180000, current_date + 3);

insert into public.debts (user_id, label, type, balance_cents, minimum_payment_cents)
values ('b0000000-0000-0000-0000-00000000000b', 'B - Mortgage', 'mortgage', 20000000, 150000);

insert into public.savings_goals (user_id, label, target_cents, saved_cents)
values ('b0000000-0000-0000-0000-00000000000b', 'B - Vacation', 150000, 20000);
