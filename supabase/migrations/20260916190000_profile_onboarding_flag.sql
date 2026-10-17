-- Tracks whether a user has completed the post-signup onboarding wizard.
-- Null means "not yet onboarded" — the app gates new sessions to the wizard
-- on that basis rather than inferring it from whether other tables have rows.
alter table public.profiles
  add column onboarding_completed_at timestamptz;
