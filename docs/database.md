# Database

Supabase project: **Own My Budget** (`soapkqeaodjawxrvslob`, org `lyonsca84-apps's Org`, region `us-east-2`). Created fresh for this app — two other pre-existing projects in the same Supabase account (`Lyons Family Budget Tracker`, `Survival Budget`) are unrelated and untouched.

## Schema

All tables live in `public` and are defined as versioned migrations in `supabase/migrations/`, applied in filename (timestamp) order. Every table has RLS enabled.

| Table group                             | Tables                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Identity                                | `profiles`, `user_settings`, `notification_preferences`                       |
| Households (schema-ready, unused in v1) | `households`, `household_members`                                             |
| Income & accounts                       | `accounts`, `income_sources`, `paychecks`                                     |
| Budgeting                               | `budget_periods`, `categories`, `budget_lines`, `transactions`                |
| Bills                                   | `bills`, `bill_payments`                                                      |
| Debt                                    | `debts`, `debt_payments`, `payoff_plans`                                      |
| Savings                                 | `savings_goals`, `goal_activity`, `savings_challenges`                        |
| Groceries & receipts                    | `receipts`, `receipt_items`, `pantry_scans`, `grocery_lists`, `grocery_items` |
| Missions                                | `missions` (shared catalog), `user_missions`                                  |
| Billing & metering                      | `entitlements`, `feature_usage`, `processed_webhook_events`                   |
| Audit                                   | `audit_log`                                                                   |

**Money** is always integer cents (`*_cents` columns, `bigint`). **Ownership** is a plain `user_id` column checked against `auth.uid()` — household-based sharing exists in the schema but isn't wired into any RLS policy's _effective_ access yet beyond the household tables themselves, since household sharing is deferred out of v1.

## Row Level Security

Every policy is explicitly scoped `to authenticated` (not left open to all roles) and reads `(select auth.uid())` rather than a bare `auth.uid()` — the wrapped form lets Postgres evaluate it once per query instead of once per row (`get_advisors` flagged the unwrapped form as a real performance issue on every one of the ~30 initial policies).

Two tables are deliberately **not client-writable at all**:

- **`entitlements`** — the single source of truth for plan tier. Only a select policy exists for `authenticated`; only a service-role webhook handler (Stripe/RevenueCat, built in Phase 8) may change it. Verified in `supabase/tests/rls_isolation.sql`: a client-side `UPDATE` on a user's own entitlements row is silently rejected.
- **`feature_usage`** — same pattern, so a client can never inflate its own remaining quota.

`processed_webhook_events` has RLS enabled with **zero** policies (not even for `authenticated`) — it's service-role-only by construction, for idempotent webhook processing in Phase 8.

Run `supabase/tests/rls_isolation.sql` against the project (via the Supabase SQL editor, `execute_sql`, or later `supabase test db`) any time RLS policies change. It proves, using two seeded test users:

- each user sees exactly their own rows and never the other's,
- cross-user updates and impersonated inserts are rejected outright,
- anonymous (no session) access returns nothing anywhere.

## Auto-provisioning

Signing up (an `auth.users` insert) fires `handle_new_user()`, which creates that user's `profiles`, `user_settings`, `notification_preferences`, and `entitlements` (defaulted to the Free tier) rows automatically. The app should never need to check for a "profile doesn't exist yet" state after a successful sign-up.

## Typed data-access layer

`packages/api` holds the generated `Database` type (`src/database.types.ts`) and a thin `createSupabaseClient()` factory (`src/client.ts`) — UI code should never call `@supabase/supabase-js`'s `createClient` directly. Add typed query functions under `src/queries/` as screens need them (`getCurrentAccount` is the first one, used by nearly every authenticated screen).

**Regenerating types after a migration:**

```
# Via the Supabase MCP tool `generate_typescript_types`, or once the CLI is set up locally:
supabase gen types typescript --project-id soapkqeaodjawxrvslob > packages/api/src/database.types.ts
```

## Environment variables

`apps/mobile/.env` (gitignored — copy from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://soapkqeaodjawxrvslob.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Both are client-safe publishable values. The service-role key must never be set as an `EXPO_PUBLIC_*` variable or committed anywhere — it only ever belongs in a server-side function's environment (Phase 6/8).

## Known follow-ups (tracked in `IMPLEMENTATION_CHECKLIST.md`)

- **Leaked password protection** is currently disabled in Supabase Auth settings (flagged by the security advisor) — enable it in the dashboard (Authentication → Policies → Password Security) when Phase 3 wires up real sign-up.
- No local Supabase CLI / Docker stack is set up yet — all development so far is against the real hosted dev project directly. Worth adding once the team grows past one contributor.
