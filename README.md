# Own My Budget

A calm, jargon-free budgeting app for people living paycheck to paycheck — hourly workers, fixed incomes, retirees, single parents. Built with Expo (React Native + React Native Web) and Supabase.

See [`PLAN.md`](./PLAN.md) for the full product plan and [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md) for a running log of what's built, verified, and still open.

## Stack

| Layer         | Choice                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| Mobile + Web  | Expo (React Native + React Native Web), TypeScript, Expo Router        |
| Shared logic  | `packages/core` — pure TypeScript, zero UI dependencies                |
| Backend       | Supabase (Postgres, Auth, Storage, Row Level Security, Edge Functions) |
| AI            | Claude API via server-side Supabase Edge Functions (never client-side) |
| Payments      | Stripe (web, test mode) via Supabase Edge Functions                    |
| Notifications | `expo-notifications`, scheduled locally                                |

## Project structure

```
apps/mobile/          Expo Router app (iOS + web)
packages/core/         Pure TypeScript: money math, dates, debt/savings/report calculations
packages/api/          Typed Supabase data-access layer — the only place that talks to @supabase/supabase-js
supabase/migrations/   Postgres schema, RLS policies, and functions, in applied order
supabase/functions/    Deno Edge Functions (AI proxying, Stripe, account deletion)
supabase/seed.sql      Two isolated test users for RLS verification
docs/                  Setup guides for AI, Stripe, auth, and database; production readiness checklist
```

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables** — copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill in your Supabase project's URL and publishable key (Project Settings → API). Never put a secret key here — anything in this file ships inside the client bundle.

3. **Set up the database** — see [`docs/database.md`](./docs/database.md) for the schema and RLS setup, and run the migrations in `supabase/migrations/` in order against your Supabase project.

4. **Set up authentication providers** (optional, email/password works out of the box) — see [`docs/auth-setup.md`](./docs/auth-setup.md) for Google/Apple OAuth.

5. **Set up AI features** (optional) — Budget Buddy, receipt scanning, and pantry scanning need `ANTHROPIC_API_KEY` set as a Supabase Edge Function secret. See [`docs/ai-setup.md`](./docs/ai-setup.md).

6. **Set up Stripe** (optional) — subscription checkout needs Stripe test-mode prices, a webhook endpoint, and 6 Edge Function secrets. See [`docs/stripe-setup.md`](./docs/stripe-setup.md).

7. **Run the app**
   ```bash
   npm run web --workspace=@own-my-budget/mobile      # or: cd apps/mobile && npm run web
   npm run ios --workspace=@own-my-budget/mobile      # requires a full Xcode install
   ```

Before shipping anything real, read [`docs/production-readiness.md`](./docs/production-readiness.md) — it consolidates every open item (accounts, legal docs, dashboard settings) tracked across development.

## Scripts (repo root)

| Command                           | What it does                                                            |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run typecheck`               | TypeScript, all workspaces                                              |
| `npm run lint`                    | ESLint, all workspaces                                                  |
| `npm run test`                    | Jest unit tests (`packages/core`'s money/date/debt/savings/report math) |
| `npm run format` / `format:check` | Prettier, whole repo                                                    |

CI (`.github/workflows/ci.yml`) runs all four on every push and PR to `main`.

## Security notes

- Row Level Security is enabled on every table — one user's data is never reachable by another, enforced at the database layer, not just in application code.
- Secrets (Anthropic, Stripe, Supabase service-role key) live only in Supabase Edge Function environment variables, never in this repository or the client bundle.
- Money is stored and calculated as integer cents throughout — never floating-point dollars.
- AI receipt/pantry extraction never writes to the budget directly; a mandatory review-and-correct step sits between extraction and any database write.
