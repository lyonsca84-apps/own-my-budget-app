-- Billing details mirrored from Stripe by the stripe-webhook function, so
-- Settings → Subscription can show the real price, billing interval and a
-- scheduled cancellation. Additive only: existing rows keep their values and
-- the new columns stay empty until Stripe's next subscription event.
-- Users can only read their own row (existing entitlements_select_own policy);
-- only the webhook (service role) writes these columns.
alter table public.entitlements
  add column if not exists billing_interval text
    check (billing_interval in ('month', 'year')),
  add column if not exists price_amount_cents integer
    check (price_amount_cents >= 0),
  add column if not exists price_currency text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancel_at timestamptz;
