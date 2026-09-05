-- Atomic upsert-or-increment for feature_usage, so two concurrent AI calls
-- from the same user can never both read used_count=N and both write N+1
-- (lost-update race). Called exclusively by Edge Functions using the
-- service-role key — feature_usage's own RLS already limits `authenticated`
-- to SELECT only, and this function's grants enforce the same boundary at
-- the function level in case that ever changes.
create or replace function public.increment_feature_usage(
  p_user_id uuid,
  p_feature_key text,
  p_period_start date
)
returns public.feature_usage
language plpgsql
security definer set search_path = public
as $$
declare
  result public.feature_usage;
begin
  insert into public.feature_usage (user_id, feature_key, period_start, used_count)
  values (p_user_id, p_feature_key, p_period_start, 1)
  on conflict (user_id, feature_key, period_start)
  do update set used_count = public.feature_usage.used_count + 1
  returning * into result;
  return result;
end;
$$;

revoke all on function public.increment_feature_usage(uuid, text, date) from public, anon, authenticated;
