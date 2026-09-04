# Own My Budget — Implementation Checklist

Running log, updated after every milestone. See `PLAN.md` for product scope and `design/handoff/` for the approved design reference.

## Product decisions log

| Decision                   | Resolution                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch platforms           | Web + iOS for v1 (Android later)                                                                                                            |
| Launch region              | US only                                                                                                                                     |
| Individuals vs. households | Individuals-only for v1; household sharing deferred                                                                                         |
| Brand primary color        | Blue/teal (matches the approved Claude Design canvas); purple reserved for Budget Buddy/premium accents                                     |
| Dark mode                  | In v1 — light / dark / system-auto toggle                                                                                                   |
| Pricing                    | Free / Guided ($5.99/mo · $49.99/yr) / Budget Buddy ($9.99/mo · $79.99/yr, 14-day trial) — see `PLAN.md` §5 for full research and rationale |
| Budget Buddy v1 scope      | Text + photo (receipt/pantry); voice input is a fast-follow, not v1                                                                         |
| Auth providers             | Email/password + Google + Apple, with email verification                                                                                    |
| Web hosting                | Vercel                                                                                                                                      |
| Payments                   | Stripe (web, existing account to connect) + RevenueCat (native, TBD)                                                                        |
| AI provider                | Anthropic API (account confirmed)                                                                                                           |

## Open items (not blocking current work, need an answer before the phase that needs them)

- [ ] GitHub repo URL — user has a GitHub account, repo status/link not yet confirmed
- [x] Supabase organization/project — org already existed (`lyonsca84-apps's Org`); created a brand-new project ("Own My Budget", `soapkqeaodjawxrvslob`, us-east-2) rather than reusing two unrelated pre-existing projects found in the account
- [ ] Enable "leaked password protection" in Supabase Auth settings (dashboard toggle, off by default) before real users can sign up
- [ ] Configure a real SMTP provider for Supabase Auth emails before launch — the default shared email service has a very low send-rate limit (hit during Phase 3 testing); see `docs/auth-setup.md`
- [ ] Google OAuth needs a Google Cloud Console OAuth client (see `docs/auth-setup.md`) — code is ready, provider isn't configured yet
- [ ] Sign in with Apple needs the Apple Developer Program membership (below) plus Services ID/key setup (see `docs/auth-setup.md`) — code is ready, provider isn't configured yet
- [ ] Final logo, app icon, support email — user will provide later
- [ ] Domain connection (user owns a domain; exact spelling to confirm before DNS/App Store Connect setup)
- [ ] Apple Developer Program account — not yet created (needed before iOS TestFlight/App Store submission, not before development)
- [ ] Google Play Console — not yet created (deferred; Android isn't in the v1 launch platform set)
- [ ] Terms of Service / Privacy Policy — none drafted yet; needed before public launch. Add placeholder + legal-review flag in Phase 9/10.
- [ ] `ios.bundleIdentifier` in `apps/mobile/app.json` is currently a placeholder (`com.ownmybudget.app`) — confirm before first App Store Connect registration (hard to change after submission)
- [ ] `PLAN.md` §2 names `claude-opus-5` as the AI model — re-verify against current Anthropic API docs when Phase 6 (Budget Buddy) actually wires up the server-side AI calls, rather than trusting a model id written months earlier

## Phase 0 — Audit, architecture, folder correction, dependency strategy, design-system extraction

**Status: Complete**

- [x] Full repository audit (PLAN.md, package.json/workspaces, Code/mobile, packages/core, Branding, App Design Inspiration, attached design ZIP)
- [x] Identified and resolved the `apps/*` workspace mismatch (Expo app was at `Code/mobile`, not `apps/*`)
- [x] Git repository initialized, `.gitignore` added
- [x] `Code/mobile` replaced with `apps/mobile` — regenerated fresh via `create-expo-app@latest` at current SDK (Expo SDK 57, React Native 0.86, React 19.2, Expo Router) rather than hand-patched forward from SDK 51, since the original shell was explicitly a throwaway Phase 0 placeholder
- [x] `apps/mobile` wired into the npm workspace, `@own-my-budget/core` resolves correctly via workspace linking
- [x] `app.json` updated: app name, iOS-only platform config (web + iOS for v1), placeholder bundle identifier (flagged above)
- [x] ESLint (flat config, ESLint 9) set up for both workspaces — `eslint-config-expo` for the app, `typescript-eslint` recommended for `packages/core`
- [x] Prettier set up at the repo root with `format` / `format:check` scripts
- [x] Minimal GitHub Actions CI (`.github/workflows/ci.yml`): format check, lint, typecheck, test on every push/PR to `main`
- [x] Design tokens extracted from the approved Claude Design canvas into `apps/mobile/src/constants/theme.ts` — full light/dark color palette, Manrope typeface, spacing scale; dark mode documented as an extension since the design pass didn't cover it
- [x] `packages/core`'s `FEATURE_REGISTRY` and `featureGate.ts` rewritten for the confirmed 3-tier pricing model (`free` / `guided` / `budgetBuddy`), including monthly vs. lifetime usage periods and tier-aware upgrade messaging
- [x] Design handoff preserved under `design/handoff/` (the `.dc.html` canvas, badges, screenshots) as a versioned pixel-reference
- [x] `PLAN.md` updated to reflect resolved decisions and the new pricing table
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` all pass at the repo root; `apps/mobile` boots successfully in a web preview

**Known limitations carried forward:** one small type-level workaround in `apps/mobile/src/components/app-tabs.web.tsx` for an upstream `expo-router@57.0.19` / `@types/react@19` ref-typing mismatch (documented inline; that file is template placeholder code replaced in Phase 1 anyway). Template demo screens (Home/Explore/tab bar) are still stock Expo Router content — real navigation and screens are Phase 1.

## Phase 1 — Application shell, navigation, reusable components, responsive layout, demo data

**Status: Complete**

- [x] Nav structure decision: PLAN.md's 5 sections (Home · Plan · Bills · Money · Helper) used identically on web and mobile, per PLAN.md §3 — not the design canvas's 6-item sidebar (which added separate Grocery/Reports items). Grocery and Reports are reachable from within Money/Home, not top-level nav.
- [x] Deterministic demo dataset added to `packages/core` (`demoData.ts`) — 8 bills, 2 credit cards, an auto loan, a mortgage, 2 savings goals, ~2 months of transactions, all integer cents; unit-tested against PLAN.md §2's exact composition
- [x] `formatCents` money-formatting helper added to `packages/core` (`money.ts`), unit-tested — screens never format money themselves
- [x] Reusable UI primitives added: `Card`, `Button` (44pt min touch target), `StatusPill` (success/warning/danger/neutral — amber for "watch this," never red, per PLAN.md's never-shame rule), `Avatar`, `EmptyState`
- [x] Added an `onPrimary` token to the theme (light: white, dark: dark ink) — the dark-mode primary blue is brightened for visibility, which flips which text color has enough contrast on top of it
- [x] Responsive navigation shell built on `expo-router/ui`'s `Tabs`/`TabList`/`TabTrigger`: native iOS gets Expo's `NativeTabs` (true native tab bar, SF Symbol icons); web gets a single `TabList` whose surrounding chrome switches between a left sidebar (≥900px — logo, nav, Budget Buddy upsell card, guest-mode indicator) and a bottom tab bar (<900px), matching PLAN.md's "same sections, wider layout on web" spec
- [x] Home screen built with real content from the demo dataset (bank balance, bills left to pay, total saved, total owed, next paycheck, bills needing attention sorted overdue-first)
- [x] Plan / Bills / Money / Helper screens ship as clearly-labeled "coming in Phase X" placeholders (via a shared `PlaceholderScreen` component) — their real content depends on budgeting math (Phase 4), debt/savings tracking (Phase 5), and the AI integration (Phase 6), so they're honestly deferred rather than half-built
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test` (26/26), `npm run format:check` all pass; manually verified in a web preview at both wide (sidebar) and mobile (375px, bottom tab bar) widths, and in both light and dark color schemes — no console errors, correct active-tab highlighting, correct amber/success/neutral status pill coloring

**Known limitations carried forward:** native iOS tab bar (NativeTabs) hasn't been run on an actual simulator yet — only the web preview has been visually verified this phase. The `expo-router/ui` `<Tabs>` navigator requires `<TabList>` to be a _direct_ child of `<Tabs>` (wrapping it in a custom component breaks screen registration with no useful error until you dig into the console) — documented inline in `app-tabs.web.tsx` for future reference.

## Phase 2 — Supabase schema, migrations, RLS, storage policies, typed data layer

**Status: Complete**

- [x] Discovered two pre-existing, unrelated Supabase projects in the account with real data in one of them — flagged to the user rather than assumed; created a fresh project per their choice
- [x] Full normalized schema across 25 tables (see `docs/database.md` for the full list), all with RLS enabled, `updated_at` triggers, and appropriate indexes/foreign keys — 15 migrations in `supabase/migrations/`
- [x] `entitlements` (plan tier) and `feature_usage` (usage metering) are select-only for the client — no insert/update/delete policy exists for `authenticated`, so only a future service-role webhook/server function can change them. Verified live: a client-side attempt to self-upgrade `plan_tier` is silently rejected by RLS.
- [x] Household sharing has real membership-based RLS now (via a `private.is_household_member()` helper + auto-owner trigger) even though it's not wired into any UI yet
- [x] Ran the security & performance advisors after the initial schema and fixed everything they found: a mutable-search-path function, 3 SECURITY DEFINER functions unintentionally exposed as public RPC endpoints (moved to a non-exposed `private` schema), ~30 RLS policies re-evaluating `auth.uid()` per-row instead of once per query, 10 missing FK indexes, and every policy explicitly scoped `to authenticated` instead of left open to all roles
- [x] Seeded two independent test users (`supabase/seed.sql`) and wrote a repeatable RLS isolation test (`supabase/tests/rls_isolation.sql`) — proves cross-user reads/writes/impersonation all fail, and anonymous access returns nothing. (One real methodology bug caught and fixed along the way: `request.jwt.claims` doesn't get cleared by `SET LOCAL ROLE`, so an early version of the anon check was accidentally still evaluating as the previous authenticated user.)
- [x] Private storage buckets (`receipts`, `pantry`) with owner-only policies keyed off the `{user_id}/...` path prefix
- [x] `packages/api` created: generated `Database` types + a typed `createSupabaseClient()` factory + one real query helper (`getCurrentAccount`) — UI code never calls `@supabase/supabase-js` directly
- [x] `apps/mobile/.env.example` (committed) and `.env` (gitignored, real dev values) added; confirmed `.env` is actually excluded from git
- [x] End-to-end connectivity verified from a plain Node script against the real project using the publishable key
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test` (26/26), `npm run format:check` all pass across all three workspaces (`core`, `api`, `mobile`)

**Known limitations carried forward:** no local Supabase CLI/Docker stack yet — everything so far runs against the real hosted dev project directly (fine solo, worth revisiting before a second contributor joins). `packages/api`'s query layer only has the one helper needed so far; more get added as each screen in later phases needs them, not spent all at once now.

## Phase 3 — Authentication, onboarding, profiles, session persistence, protected routes

**Status: Complete**

- [x] Scope decision: onboarding here is Welcome → Sign up/Login/Guest → dashboard, not the full 5-step data-entry wizard (pay schedule/balances/bills/goal) — that collects Phase 4 budgeting data and belongs there. Account deletion is explicitly Phase 7's, not this phase's.
- [x] Email/password sign-up, login, logout, forgot/reset-password all built and verified against the live project through the real UI (not just API calls) — including error states (invalid email format, rate limiting, wrong credentials)
- [x] Session persistence via `@react-native-async-storage/async-storage` (native) / supabase-js's own localStorage (web), with `packages/api`'s `createSupabaseClient` made storage-configurable rather than hardcoding a platform
- [x] Protected routes via Expo Router's `Stack.Protected` guards (signed-in/guest → tabs, signed-out/loading → auth flow, password-recovery → dedicated reset screen) — verified a direct deep-link to a tab route while genuinely signed out still redirects to Welcome, not just the initial app load
- [x] Guest mode is real now: a persisted local flag (not hardcoded UI), with a working "continue as guest" and "exit guest mode" path, and the sidebar/Settings screen show real signed-in account info instead of a static "Jordan"/"Guest mode" label
- [x] Google and Apple sign-in wired to `supabase.auth.signInWithOAuth` in code; **not functional yet** — both need OAuth credentials only the user can create. Documented exactly what's needed in `docs/auth-setup.md` rather than shipping dead buttons silently.
- [x] Minimal Settings screen (modal, reachable via a header avatar tap on Home) with account info + log out / create-account-from-guest — native platforms had no other way to log out before this
- [x] Found and fixed a real bug from Phase 2's seed script: GoTrue (Supabase Auth) scans several `auth.users` columns (`confirmation_token`, `recovery_token`, etc.) as non-nullable strings — leaving them `NULL` (the column default) breaks with "converting NULL to string is unsupported" on that user's _next_ login. Only surfaced by testing an actual sign-in through the real UI, not by the earlier RLS tests. Fixed both the two live seeded rows and `supabase/seed.sql` itself.
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test` (26/26), `npm run format:check` all pass across all three workspaces; confirmed zero stray test accounts were left in the database after testing

**Known limitations carried forward:** deep-linking directly to a specific tab (e.g. `/plan`) at the exact moment the auth guard is resolving can land on the default Home tab instead — a minor Expo Router state-restoration nuance, not a security issue (the security property — unauthenticated users never see tab content, confirmed by direct deep-link test — holds). Password-reset email click-through could only be verified up to "the email send succeeds"; actually clicking the link needs a real inbox, which is manual QA for the user to do once.

## Phase 4 — Dashboard, budgeting, paychecks, categories, transactions, core calculations

- [ ] Not started

## Phase 5 — Bills, reminders, debt tools, savings goals, challenges

- [ ] Not started

## Phase 6 — Receipts, groceries, pantry tools, Budget Buddy AI

- [ ] Not started

## Phase 7 — Reports, exports, settings, notifications, account deletion

- [ ] Not started

## Phase 8 — Subscriptions, entitlements, paywalls, restore/manage purchase flows

- [ ] Not started

## Phase 9 — Accessibility, security, privacy, performance, observability, QA

- [ ] Not started

## Phase 10 — GitHub finalization, staging deployment, production checklist, store submission prep

- [ ] Not started
