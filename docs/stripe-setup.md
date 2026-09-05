# Stripe subscription setup

## Status

Code is complete and deployed (Edge Functions `stripe-checkout`, `stripe-portal`, `stripe-webhook`; mobile paywall and subscription-management screens). **Test mode only** — nothing here can charge a real card until you deliberately switch to live-mode keys later, which is a decision for you to make well after this, not something built into this phase.

Two things only you can do, since they require your own Stripe dashboard access and secrets:

## 1. Create the 4 prices (Stripe dashboard, Test mode)

Go to **https://dashboard.stripe.com/test/products** (note `/test/` in the URL — confirms you're in test mode) → **Add product**. Create two products, each with two recurring prices:

| Product      | Price                | Amount | Billing period |
| ------------ | -------------------- | ------ | -------------- |
| Guided       | Guided Monthly       | $5.99  | Monthly        |
| Guided       | Guided Yearly        | $49.99 | Yearly         |
| Budget Buddy | Budget Buddy Monthly | $9.99  | Monthly        |
| Budget Buddy | Budget Buddy Yearly  | $79.99 | Yearly         |

You don't need to configure a trial on the price itself — the 14-day Budget Buddy trial is applied in code at checkout time, not on the price.

After creating each price, copy its ID (starts with `price_...`) — you'll need all 4 for step 3.

## 2. Create the webhook endpoint (Stripe dashboard, Test mode)

Go to **https://dashboard.stripe.com/test/workbench/webhooks** → **Add destination** (or **+ Add endpoint**):

- Endpoint URL: `https://soapkqeaodjawxrvslob.supabase.co/functions/v1/stripe-webhook`
- Events to send: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

After creating it, click into the endpoint and reveal its **Signing secret** (starts with `whsec_...`) — you'll need it for step 3.

## 3. Set the secrets (Supabase dashboard → Project Settings → Edge Functions → Secrets)

Add all 6:

| Secret name                        | Value                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                | Your Stripe **test mode** secret key (Developers → API keys → Secret key, starts with `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET`            | The signing secret from step 2 (`whsec_...`)                                                         |
| `STRIPE_PRICE_GUIDED_MONTHLY`      | Price ID from step 1                                                                                 |
| `STRIPE_PRICE_GUIDED_YEARLY`       | Price ID from step 1                                                                                 |
| `STRIPE_PRICE_BUDGETBUDDY_MONTHLY` | Price ID from step 1                                                                                 |
| `STRIPE_PRICE_BUDGETBUDDY_YEARLY`  | Price ID from step 1                                                                                 |

Same rule as `ANTHROPIC_API_KEY`: never paste any of these into chat. No redeploy needed after setting them.

## Architecture

- **`stripe-checkout`** — authenticated Edge Function. Verifies the caller's JWT, creates (or reuses) a Stripe Customer, creates a Checkout Session in `subscription` mode with `client_reference_id` and `subscription_data.metadata.supabase_user_id` set to the caller's user id (this is how the webhook later knows which of our users a given Stripe subscription belongs to — no separate lookup table needed), applies the 14-day trial only when the selected price is a Budget Buddy price, and returns the Checkout URL for the client to redirect to.
- **`stripe-portal`** — authenticated. Creates a Billing Portal session for the caller's stored `stripe_customer_id` and returns its URL. This is how "manage/cancel/switch plan" (Phase 8's title) is satisfied — Stripe's own hosted portal handles all of that, so there's no custom plan-switching UI to build or get wrong.
- **`stripe-webhook`** — the one Edge Function deployed with `verify_jwt: false` (a deliberate, documented exception — Stripe webhooks aren't authenticated with a Supabase session; signature verification via `stripe.webhooks.constructEventAsync` against `STRIPE_WEBHOOK_SECRET` is the real authentication here). Handles `checkout.session.completed` (persists `stripe_customer_id`), `customer.subscription.updated` (maps the subscription's price back to a plan tier via the 4 price-ID secrets above, updates `plan_tier`/`status`/`trial_ends_at`/`current_period_end`), and `customer.subscription.deleted` (reverts to `free`). Idempotent via `processed_webhook_events` (the same table Phase 2's schema already reserved for exactly this).
- Client wrappers live in `packages/api/src/queries/edge-functions.ts` (`createCheckoutSession`, `createPortalSession`), following the same pattern as the Phase 6 AI functions.

## Native (iOS) subscriptions — deferred

RevenueCat/native in-app purchases are not built this phase — you don't have an Apple Developer account yet, which is a hard prerequisite even to configure or test them. The native paywall screen shows a "manage your subscription on the web" message instead of a purchase flow, the same code-ready-but-unconfigured pattern already used for Google/Apple sign-in since Phase 3.

## Testing without a real card

Stripe test mode accepts well-known test card numbers with no real charge — e.g. `4242 4242 4242 4242`, any future expiry, any CVC, any postal code. Use these to test the full Checkout → webhook → entitlement-update flow once the 3 steps above are done.
