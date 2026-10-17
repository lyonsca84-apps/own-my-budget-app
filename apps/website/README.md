# Own My Budget website

The public marketing site plus the account, checkout and billing pages, built from the approved Claude website design (`Branding/Website/Own-My-Budget_ website design.zip`) and the brand messaging guide (`Branding/Brand Guidelines/Messaging/`).

Static multi-page [Vite](https://vite.dev) site, plain TypeScript, no UI framework. It shares the app's Supabase project and the existing Stripe Edge Functions. It does not replace or change the Expo app in `apps/mobile`.

## Pages

| Route | Source | Notes |
| --- | --- | --- |
| `/` | `index.html` | Home v3 design |
| `/pricing` | `pricing.html` | Pricing Page design; plan cards + comparison table built from `@own-my-budget/core` |
| `/features/savings-goals`, `/features/debt-tracking`, `/features/budget-missions` | `features/*.html` | Feature page designs |
| `/signup`, `/login`, `/reset-password` | `*.html` + `src/pages/auth.ts` | Supabase email + password, same as the app |
| `/checkout` | `checkout.html` + `src/pages/checkout.ts` | "Review your plan" → Stripe Checkout |
| `/checkout/success`, `/checkout/canceled` | `checkout/*.html` | Success waits for the webhook-updated entitlement |
| `/account` | `account.html` + `src/pages/account.ts` | Plan & Billing, usage, Stripe Customer Portal |
| `/about`, `/resources`, `/contact`, `/privacy`, `/terms`, `/accessibility`, `/404` | `*.html` | Content pages |

Page layout keeps the design's inline styles so it matches the approved files. `partials/header.html` and `partials/footer.html` are shared by all pages through a small plugin in `vite.config.ts`.

## Run it

```sh
cp apps/website/.env.example apps/website/.env.local   # then fill in the values
npm install                                            # from the repo root
npm run dev --workspace @own-my-budget/website         # http://localhost:5173
npm run build --workspace @own-my-budget/website       # outputs apps/website/dist
npm run preview --workspace @own-my-budget/website     # serve the build at http://localhost:4173
```

## Environment variables

Only public values go here. Vite puts every `VITE_` variable into the browser bundle.

| Variable | Required | What it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes, for accounts | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes, for accounts | Supabase publishable key (`sb_publishable_…`) |
| `VITE_APP_URL` | Optional | The Own My Budget web app, for "Open my budget" buttons |
| `VITE_SUPPORT_EMAIL` | Optional | Support inbox shown on Contact and legal pages |

Without the Supabase values the marketing pages still work, and the account pages show a "not connected yet" message.

The Supabase service-role key and every Stripe secret (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the four `STRIPE_PRICE_*` IDs) live **only** in Supabase Edge Function secrets. See `docs/stripe-setup.md`.

## How billing works

1. A visitor picks a plan. The choice travels as `?plan=guided&billing=yearly` (plus sessionStorage) through sign-up or log-in.
2. `/checkout` shows "Review your plan", then calls the existing `stripe-checkout` Edge Function, which creates a Stripe Checkout Session server-side and returns its URL.
3. Stripe sends `checkout.session.completed` / `customer.subscription.*` events to `stripe-webhook`, which verifies the signature and updates `entitlements`. **That is the only thing that grants access.**
4. `/checkout/success` only *reads* `entitlements` and waits until the webhook has updated it. Free access stays in place until then.
5. People who already pay never see "Choose…" buttons. Changes go through "Manage subscription" → `stripe-portal` → Stripe Customer Portal, so nobody ends up with two subscriptions.

No database migrations are needed for the website. It uses the existing `profiles`, `entitlements` and `feature_usage` tables under their existing row-level security.

## Supabase Auth settings to add

In Supabase → Authentication → URL Configuration → **Redirect URLs**, add the website's address(es), for example:

- `http://localhost:5173/**` and `http://localhost:4173/**` (local)
- `https://<your-preview-or-production-domain>/**`

Sign-up confirmation emails and password-reset emails link back to the website. If a URL isn't on the list, Supabase sends people to the project's Site URL instead.

## Deploying

`vercel.json` is set up for a Vercel project with **Root Directory = `apps/website`** (framework Vite, output `dist`, clean URLs). Add the `VITE_*` variables in that project's settings. Use a preview deployment and Stripe **test mode** until you're ready to launch.

## Decisions where the design left room

- **Plan benefits come from `packages/core` (`FEATURE_REGISTRY`, `PLAN_PRICING`)**, the limits the app actually enforces, rather than the design's draft lists (marked "Verify" in the design). Household budgeting was left out because it's deferred for v1, and the AI, Mission and photo allowances match what each plan really includes.
- **Trial wording matches how the trial works today.** Budget Buddy gets a 14-day Stripe trial with a payment method collected at checkout. The design proposed a no-card, app-tracked trial that "needs sign-off before launch". That would be a backend change, so it hasn't been built.
- **Testimonials are hidden.** The design only had placeholders ("Testimonial to be confirmed"). Add the section back once real, approved quotes exist.
- **The "App store badges" placeholder is removed** until the apps are published.
- **Privacy and Terms are plain-language drafts**, clearly labelled, until reviewed legal documents are ready.
