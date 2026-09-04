-- Records AI-created and other sensitive changes for the account's own
-- history/undo affordance. Select-only for the owner — inserts happen via
-- server-side functions (service role), never directly from the client, so
-- a user can't tamper with their own audit trail.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  actor text not null default 'user' check (actor in ('user', 'ai', 'system')),
  action text not null,
  entity_table text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_user_id_idx on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_own" on public.audit_log
  for select using (auth.uid() = user_id);
