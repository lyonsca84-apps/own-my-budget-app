-- Budget Buddy voice (tap-to-talk) usage ledger. One row per provider call
-- — a speech-to-text transcription or a text-to-speech generation — so the
-- two are counted separately (the reasoning step stays metered by the
-- existing feature_usage 'budgetBuddyAction' key, unchanged).
--
-- Deliberately NOT stored here: audio, transcripts, reply text, or any
-- budget data. Only counts, durations, character counts, and cost.
--
-- This one small table carries every voice control:
--   * per-user monthly allowance  -> rows this UTC month, by kind
--   * rate limit                  -> rows in the last 60 seconds, by kind
--   * duplicate submissions       -> unique (user_id, kind, request_id)
--   * provider spending protection-> sum(cost_micro_usd) this UTC month
--   * estimated vs reported cost  -> cost_source
--
-- The existing feature_usage / increment_feature_usage pair is
-- check-then-increment (two round trips), which two concurrent requests can
-- both pass. Voice needs the check and the write to be one transaction, so
-- reserve_voice_usage below does both under a per-user advisory lock.
create table public.voice_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('transcription', 'speech')),
  -- Client-generated id for one tap; the unique constraint below is what
  -- makes a double-submit a no-op instead of a second paid call.
  request_id text not null check (char_length(request_id) between 8 and 64),
  -- 'reserved'  : provider call in flight (or the function died mid-call —
  --               still counted, so a crash can never hand allowance back).
  -- 'completed' : provider call succeeded.
  -- 'cancelled' : the customer cancelled mid-call; still counted, because
  --               the provider may already have charged for it.
  -- 'failed'    : provider call failed; NOT counted against the allowance.
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'cancelled', 'failed')),
  audio_seconds numeric(8, 2),
  characters integer,
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  -- 'reported'  : the provider returned this cost for this request.
  -- 'estimated' : computed from duration/characters and a configured rate.
  cost_source text not null default 'estimated' check (cost_source in ('estimated', 'reported')),
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, request_id)
);

create index voice_usage_ledger_user_kind_created_idx
  on public.voice_usage_ledger (user_id, kind, created_at desc);
create index voice_usage_ledger_created_idx on public.voice_usage_ledger (created_at);

create trigger set_voice_usage_ledger_updated_at
  before update on public.voice_usage_ledger
  for each row execute function public.set_updated_at();

alter table public.voice_usage_ledger enable row level security;

-- Read-only for the owner; no insert/update/delete policy is granted to
-- `authenticated`, so only the service role (the Edge Function) can write.
create policy "voice_usage_ledger_select_own" on public.voice_usage_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomically checks every limit and records the reservation. Returns one
-- row: outcome is 'reserved' (with ledger_id) or the reason it was refused
-- ('duplicate' | 'limit' | 'rate_limited' | 'budget').
--
-- The advisory lock is per user, so one user's concurrent taps are fully
-- serialized: the allowance and rate limit cannot be bypassed by racing.
-- The app-wide budget check reads across users without a global lock, so
-- simultaneous requests from DIFFERENT users can overshoot the monthly
-- budget by at most their own estimated cost (fractions of a cent each).
create or replace function public.reserve_voice_usage(
  p_user_id uuid,
  p_kind text,
  p_request_id text,
  p_monthly_limit integer,
  p_rate_limit_per_minute integer,
  p_estimated_cost_micro_usd bigint,
  p_monthly_budget_micro_usd bigint
)
returns table (outcome text, ledger_id uuid, used_count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_used integer;
  v_recent integer;
  v_spend bigint;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('voice_usage:' || p_user_id::text, 0));

  if exists (
    select 1 from public.voice_usage_ledger l
    where l.user_id = p_user_id and l.kind = p_kind and l.request_id = p_request_id
  ) then
    return query select 'duplicate'::text, null::uuid, 0;
    return;
  end if;

  select count(*)::integer into v_used
  from public.voice_usage_ledger l
  where l.user_id = p_user_id
    and l.kind = p_kind
    and l.status <> 'failed'
    and l.created_at >= v_month_start;

  if v_used >= p_monthly_limit then
    return query select 'limit'::text, null::uuid, v_used;
    return;
  end if;

  -- Counts failed attempts too, so repeated failing calls are throttled.
  select count(*)::integer into v_recent
  from public.voice_usage_ledger l
  where l.user_id = p_user_id
    and l.kind = p_kind
    and l.created_at > now() - interval '1 minute';

  if v_recent >= p_rate_limit_per_minute then
    return query select 'rate_limited'::text, null::uuid, v_used;
    return;
  end if;

  select coalesce(sum(l.cost_micro_usd), 0)::bigint into v_spend
  from public.voice_usage_ledger l
  where l.status <> 'failed' and l.created_at >= v_month_start;

  if v_spend + greatest(p_estimated_cost_micro_usd, 0) > p_monthly_budget_micro_usd then
    return query select 'budget'::text, null::uuid, v_used;
    return;
  end if;

  -- The estimate is held against the budget while the call is in flight,
  -- then replaced with the reported (or re-estimated) cost on finalize.
  insert into public.voice_usage_ledger (user_id, kind, request_id, cost_micro_usd)
  values (p_user_id, p_kind, p_request_id, greatest(p_estimated_cost_micro_usd, 0))
  returning id into v_id;

  return query select 'reserved'::text, v_id, v_used + 1;
end;
$$;

-- Settles a reservation exactly once (only a row still 'reserved' changes).
create or replace function public.finalize_voice_usage(
  p_ledger_id uuid,
  p_status text,
  p_cost_micro_usd bigint,
  p_cost_source text,
  p_audio_seconds numeric,
  p_characters integer,
  p_model text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.voice_usage_ledger
  set status = p_status,
      cost_micro_usd = greatest(p_cost_micro_usd, 0),
      cost_source = p_cost_source,
      audio_seconds = p_audio_seconds,
      characters = p_characters,
      model = p_model
  where id = p_ledger_id and status = 'reserved';
end;
$$;

revoke all on function public.reserve_voice_usage(uuid, text, text, integer, integer, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.finalize_voice_usage(uuid, text, bigint, text, numeric, integer, text)
  from public, anon, authenticated;
