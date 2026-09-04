-- Household sharing is deferred out of the v1 launch (individuals-only),
-- but the schema is built correctly now so it's additive later, not a
-- rewrite. Membership-based RLS is real from day one even though no UI
-- creates households yet.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Helper used by RLS below: is the current user a member of this household?
-- SECURITY DEFINER + a fixed search_path avoids recursive-RLS evaluation
-- (household_members' own policy would otherwise call itself).
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

-- Auto-add the creator as the 'owner' member. Without this, inserting the
-- very first household_members row would need an owner-membership check
-- that can never be true yet (nothing to bootstrap from).
create or replace function public.handle_new_household()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_household_created
  after insert on public.households
  for each row execute function public.handle_new_household();

alter table public.households enable row level security;

create policy "households_select_member" on public.households
  for select using (public.is_household_member(id));
create policy "households_insert_self" on public.households
  for insert with check (created_by = auth.uid());
create policy "households_update_owner" on public.households
  for update using (
    exists (
      select 1 from public.household_members
      where household_id = id and user_id = auth.uid() and role = 'owner'
    )
  );

alter table public.household_members enable row level security;

create policy "household_members_select_member" on public.household_members
  for select using (public.is_household_member(household_id));
create policy "household_members_insert_owner" on public.household_members
  for insert with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid() and hm.role = 'owner'
    )
  );
create policy "household_members_delete_owner_or_self" on public.household_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid() and hm.role = 'owner'
    )
  );
