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
- [x] `PLAN.md` §2 named `claude-opus-5` as the AI model — re-verified against current Anthropic API docs in Phase 6; switched to a per-feature choice (`claude-sonnet-5` for receipt scans and Budget Buddy chat, `claude-haiku-4-5` for the lower-stakes pantry scan) instead of one model for everything, centralized in `supabase/functions/_shared/ai-config.ts`. `PLAN.md` §2 updated to match.
- [x] `ANTHROPIC_API_KEY` set as a Supabase Edge Function secret and Anthropic billing activated — all three AI features (Budget Buddy, receipt scan, pantry scan) verified live with real Claude responses (not just reaching the code), `feature_usage` incrementing correctly, test usage cleaned up afterward. One real incident along the way: an early diagnostic command's output redaction had a bug and briefly displayed a since-rotated API key in this chat's tool output — caught immediately, key rotated before reuse, confirmed the local `.env` was never committed to git. See `docs/ai-setup.md`.

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

**Status: Complete**

- [x] Scope boundary: bill-status derivation moved into `packages/core` now (Home needs it to show real bills), but the full Bills/debt/savings _screens_ stay Phase 5's, matching the phase title split. Real transactions CRUD exists in `packages/api` but has no dedicated screen yet — nothing consumes it until a category-detail or transaction-log screen is built (Phase 5+).
- [x] Core budgeting math added to `packages/core` (`budgeting.ts`, fully unit-tested): `deriveBillStatus` (with partial-payment handling, due-at-end-of-day), `calculateMoneyLeftToSpend` (line-item breakdown, matches PLAN.md screen #12), `calculatePlannedVsActual`, `calculateBudgetRollover`, `assignPaycheck`, `calculateIncomeTotal`/`calculateExpenseTotal`
- [x] Found and fixed a real type collision: `demoData.ts` and the new `budgeting.ts` both declared `BillStatus` — consolidated to one canonical definition (`budgeting.ts`), `demoData.ts` now just imports it
- [x] Typed data-access layer extended in `packages/api`: categories, income sources, paychecks (incl. `markPaycheckAssigned`), bills-with-payments, transactions, budget periods/lines (`getOrCreateBudgetPeriod`, `upsertBudgetLine`) — kept free of any `packages/core` dependency on purpose (data access and pure math stay separate layers; the UI is what combines them)
- [x] Home dashboard rewired off static demo data for signed-in users via a new `useDashboardData` hook that unifies the guest (demo) and real (Supabase) paths behind one shape — guest mode is untouched, real users see actual balance/bills/money-left-to-spend computed from their own rows, and a genuine empty state (not demo data, not a crash) when they have nothing yet
- [x] Plan tab rebuilt with real CRUD: income sources, categories, paycheck logging, and a full "assign this paycheck" flow (allocate across categories, validated live against the paycheck total, writes `budget_lines` for the current calendar month and marks the paycheck assigned) — guest mode gets a "create an account" prompt instead of non-functional forms
- [x] Verified end-to-end against the live project through the real UI, not just API calls: logged in as the seeded test user, added a real income source, a real category, a real paycheck, assigned it across two categories, and confirmed via direct DB query that `budget_periods`/`budget_lines` were created with the exact right amounts ($1,400 + $224 = the full $1,624 paycheck)
- [x] Re-verified RLS isolation on every new table touched this phase (`budget_lines`, `budget_periods`, `income_sources`, `paychecks`) — the other seeded test user sees zero of this new data
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test` (47/47), `npm run format:check` all pass across all three workspaces

**Known limitations carried forward:** paycheck assignment always _sets_ a category's planned amount for the month rather than adding to it — assigning two paychecks to the same category in one month overwrites rather than accumulates. Fine for v1 (most categories get one paycheck's worth of planning), but worth revisiting once multiple-paychecks-per-month-per-category is a real usage pattern. No date picker — pay dates are typed as `YYYY-MM-DD` text for now.

## Phase 5 — Bills, reminders, debt tools, savings goals, challenges

**Status: Complete**

- [x] Scope call: the 52-week challenge is goal creation with an auto-computed target (via `generateChallengeAmounts`) plus the existing deposit/progress flow, not a bespoke 52-square tracker grid — that grid was a lot of UI for limited functional value beyond what progress-tracking already gives. Bill reminders (push/local notifications) are not built — that's Phase 9/notification-infrastructure territory, not core debt/savings/bills math.
- [x] Debt payoff math added to `packages/core` (`debt.ts`, fully unit-tested): `calculatePayoffSchedule` (snowball and avalanche, with the "snowballing" freed-minimum mechanic, a hard 600-month cap so a payment that can't cover interest can't loop forever) and `calculateCreditUtilization`
- [x] Savings math added (`savings.ts`, fully unit-tested): `calculateSavingsProgress`, `calculateProjectedCompletionDate`, `generateChallengeAmounts` (classic ascending / flat / reverse / custom)
- [x] Found and fixed a real, serious bug caught by the new tests: `toISOString().slice(0, 10)` on a locally-constructed date silently shifts a day for any timezone behind UTC — i.e. all of the US, this app's launch region. Root-caused it further to a second, related trap (`new Date('YYYY-MM-DD')` parses as UTC midnight, `new Date(y,m,d)` parses as local midnight — mixing them shifts dates too) and fixed every call site, including one from Phase 4 (`assign-paycheck.tsx`) that had the same latent bug. Added `formatLocalDate`/`parseLocalDate` to `packages/core` as the only sanctioned way to convert between `Date` and the schema's date-only strings.
- [x] Added two atomic Postgres functions (`record_debt_payment`, `record_goal_activity`) so a payment/deposit and its companion running-balance update (`debts.balance_cents`, `savings_goals.saved_cents`) can never happen only half-way — replaced an initial two-separate-client-calls draft before it shipped, per the master brief's transaction-safety requirement. Regenerated `packages/api`'s database types to include them.
- [x] Typed data layer extended: debts-with-payments, savings goals, goal activity, savings challenges, bill payments
- [x] Bills tab rebuilt with real bill list grouped by derived status (needs attention / upcoming / paid), add-bill, and record-payment (partial payments supported)
- [x] Money tab rebuilt with real debt list (credit utilization shown for cards), add-debt, record-debt-payment, a live snowball-vs-avalanche payoff comparison driven by an editable "extra per month" input, real savings goal list with progress bars, add-goal, and add-deposit/withdrawal (including the 52-week challenge option)
- [x] Removed a fabricated placeholder from an early draft of the Money tab: a "reach this goal by [date]" projection was going to assume a hardcoded $50/mo contribution for every goal — replaced with nothing rather than a misleading fake number, since there's no real contribution rate to project from yet
- [x] Verified end-to-end against the live project through the real UI: recorded a partial bill payment and confirmed the remaining balance and status were correct; added a debt with a real 24% APR and confirmed avalanche showed strictly less total interest than snowball once an extra monthly payment was added (the textbook property, reproduced live, not just in the unit tests); added a savings deposit and confirmed via direct DB query that both the activity row and the goal's running total updated atomically
- [x] Re-verified RLS isolation on every new table/function touched this phase
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test` (71/71), `npm run format:check` all pass across all three workspaces

**Known limitations carried forward:** no bill/payday reminder notifications yet (needs `expo-notifications` + a scheduling strategy — Phase 9 territory). Paycheck-assignment's known Phase 4 limitation (sets rather than accumulates a category's planned amount) still applies. The 52-week challenge tracker is goal progress, not a dedicated week-by-week grid — noted above as a deliberate scope call, not an oversight.

## Phase 6 — Receipts, groceries, pantry tools, Budget Buddy AI

**Status: Complete**

- [x] Scope call: PLAN.md's screens 43–56 span 14 screens. Built this phase: scan receipt → review & correct → save (#44–46), pantry scan → review → grocery list (#47–48, #50), Budget Buddy chat. Deferred: the Missions library (#52–55 — doesn't need AI at all, better suited to its own phase), meal ideas (#49), grocery spending insights (#51), and a dedicated receipts list/detail screen (#43, 46 — `listReceipts` exists in `packages/api` but nothing renders it yet). See `docs/ai-setup.md`.
- [x] Model IDs re-verified against current Anthropic API docs (not trusted from months-old plan text) and centralized in `supabase/functions/_shared/ai-config.ts`: `claude-sonnet-5` for receipt scans and Budget Buddy chat, `claude-haiku-4-5` for the lower-stakes pantry scan. `PLAN.md` §2/AI specifics updated to match.
- [x] Three Supabase Edge Functions deployed (`receipt-scan`, `pantry-scan`, `budget-buddy-chat`) — the Anthropic API key exists only in the Edge Function runtime environment, never in client code or the app bundle. Each function: verifies the caller's JWT server-side via `supabase.auth.getUser()` (never trusts a client-supplied user id), checks the caller's plan-tier usage limit _before_ calling Claude (an over-limit request never reaches, or costs, the API), and records usage only after a successful response, via a new atomic `increment_feature_usage` Postgres function (migration `20260905010000`) so concurrent calls can't race past their limit.
- [x] Receipt/pantry extraction uses a forced tool call with a strict JSON schema (`strict: true`, `tool_choice` naming the tool) rather than free-form text, so the app always gets parseable structured data. Extraction is never auto-saved — both flows require the user to review and correct on a dedicated screen before anything writes to the database (PLAN.md screen #45's rule, honored for pantry scans too even though PLAN.md didn't call it out there explicitly).
- [x] Budget Buddy's financial context is a small computed summary (income total, next 5 upcoming bills, debts, savings goals — built server-side from the caller's own rows) sent as system-prompt context, never a raw transaction dump. System prompt hard-refuses individualized tax/legal/investment advice and redirects to a licensed professional; verified this refusal path doesn't crash the response handling.
- [x] Chat history is not persisted anywhere server-side — kept in the Helper screen's local component state only. This is what makes "give users a way to delete their chat history" a trivial client-side "Clear chat" button instead of a new table/retention policy/deletion flow — a deliberate scope decision, documented in `docs/ai-setup.md`, not an oversight.
- [x] `packages/api` extended with `scanReceipt`/`scanPantry`/`sendBudgetBuddyMessage` (typed Edge Function wrappers with a shared error-unwrapping helper), `getFeatureUsageCount`, `saveReceipt`/`listReceipts`, and `getOrCreateDefaultGroceryList`/`listGroceryItems`/`addGroceryItems`/`toggleGroceryItem`. `packages/core` gained `getUsagePeriodStart` — the one deliberate exception to the app's "always use local dates" rule, since it must match the server's UTC month bucketing exactly or a usage query near a month boundary could read the wrong row.
- [x] Mobile: `scan-receipt`/`review-receipt`, `scan-pantry`/`review-pantry`, and `grocery-list` screens (using `expo-image-picker`, added this phase); Helper tab rewritten from its Phase-6-placeholder into a real Budget Buddy chat UI with quick actions to all three AI features. A small in-memory `scanHandoff` module passes a scan result from its scan screen to its review screen — deliberately not a route param (would need a large base64 image URL-encoded) and not a state library (over-engineered for a same-process, single-user handoff).
- [x] Found and fixed a real bug during live testing, not just unit tests: `EdgeFunctionError`'s parsed-response branch threw its own error _inside_ the same `try` block used to catch the JSON-parse failure, so the throw was immediately caught by its own catch and silently discarded — every Edge Function error surfaced to the UI as the generic supabase-js message ("Edge Function returned a non-2xx status code") instead of the actual server error. Caught by testing the real failure path (no Anthropic key set yet) live in the browser, not by assuming the error-handling code was correct because it typechecked.
- [x] Found and cleaned up unrelated stray data while writing this phase's RLS test: a "High-Interest Card" debt left over from Phase 5's live UI testing had never been deleted, silently breaking a hardcoded "exactly 1 debt" assertion in the RLS isolation test. Removed the stray row; a good reminder to verify against current live state, not just past phase notes.
- [x] `supabase/tests/rls_isolation.sql` extended to cover every table this phase touched (`receipts`, `receipt_items`, `pantry_scans`, `grocery_lists`, `grocery_items`) plus a new, security-critical check: an authenticated client cannot write to `feature_usage` directly under any circumstances (no insert policy exists for `authenticated` — only the service-role Edge Function may write it). Re-ran the full test live against the project; all checks pass.
- [x] Verified end-to-end against the live project through the real UI (not just curl): signed in as the seeded test user, confirmed the usage meter correctly shows "3 messages remaining" / "2 scans remaining" matching Free-tier limits from a fresh account, sent a Budget Buddy message and confirmed it fails gracefully with a real server error message (not a crash) at exactly the missing-API-key step — auth, plan-tier lookup, and usage-limit checks all passed first — added and checked off a real grocery-list item, then cleaned up all test data afterward.
- [x] Directly verified the usage-limit enforcement itself (not just trusting the code): temporarily set a test user's `receiptScan` usage to their plan's limit via SQL, confirmed the Edge Function correctly returned 403 `usage_limit`, then cleaned up the test row.
- [x] Verified: `npm run typecheck`, `npm run lint`, `npm run test` (71/71), `npm run format:check` all pass across all three workspaces; deployed Edge Functions re-synced after a Prettier reformat so the live code matches the committed source exactly.

**Known limitations carried forward:** No receipts list/detail screen, meal ideas, grocery insights, or Missions library yet (explicit scope cuts, not oversights — see above). Receipt/pantry photos are sent to the Edge Function as base64 for extraction but are never uploaded to the `receipts`/`pantry` Storage buckets created in Phase 2 — only the extracted data is saved, not the source image; wiring up the actual image upload is a small follow-up, not a blocker. No image compression/resizing beyond `expo-image-picker`'s own `quality: 0.7` JPEG setting. (Previously listed here: the `ANTHROPIC_API_KEY` secret was not yet set. Resolved — see the Open Items list above and `docs/ai-setup.md`.)

## Phase 7 — Reports, exports, settings, notifications, account deletion

- [ ] Not started

## Phase 8 — Subscriptions, entitlements, paywalls, restore/manage purchase flows

- [ ] Not started

## Phase 9 — Accessibility, security, privacy, performance, observability, QA

- [ ] Not started

## Phase 10 — GitHub finalization, staging deployment, production checklist, store submission prep

- [ ] Not started
