-- Every policy so far relies on auth.uid() evaluating to NULL for the anon
-- role, which is correct for real requests (verified in
-- supabase/tests/rls_isolation.sql) but not as explicit as it should be.
-- ALTER POLICY ... TO authenticated makes the restriction structural rather
-- than incidental, and lets Postgres skip evaluating the policy at all for
-- any role other than authenticated.

do $$
declare
  rec record;
begin
  for rec in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and roles = array['public']::name[] -- no explicit TO clause = applies to all roles
  loop
    execute format('alter policy %I on %I.%I to authenticated', rec.policyname, rec.schemaname, rec.tablename);
  end loop;
end $$;
