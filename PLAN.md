# Own My Budget — Product & Build Plan

> **Disclaimer (must appear in-app):** Own My Budget provides educational budgeting tools and general information. It does not provide financial, investment, tax, accounting, or legal advice.

**Status:** Phase 0 complete (workspace scaffold, tooling, design tokens, feature-gate registry). No product screens built yet — any interface change gets a preview and your approval first. See `IMPLEMENTATION_CHECKLIST.md` for current progress.

---

## 1. Who this is for, and the design rules that follow

Hourly workers, fixed incomes, retirees, single parents, families, anyone living paycheck to paycheck.

**Design principles (these drive every screen):**

1. **Plain words, never jargon.** "Money left to spend," not "discretionary surplus." "What you owe," not "liabilities."
2. **One question per screen** during setup and any multi-step flow.
3. **Never shame.** Overspending shows in amber, not red. Copy says "Let's adjust the plan," not "You failed."
4. **Big targets, big type.** 44pt minimum tap targets, 17pt minimum body text, full Dynamic Type support.
5. **Answer the real question first.** Every screen leads with the number the user actually came for.
6. **Nothing is required.** Every field can be skipped; the app works with partial data.

**Calm palette:** warm off-white background, deep slate text, soft sage green for "on track," warm amber for "watch this," muted clay only for genuinely overdue items. Rounded cards, generous whitespace, one accent color per screen.

---

## 2. Technical approach

### Recommended stack

| Layer         | Choice                                                                                                                       | Why                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile + Web  | **Expo (React Native + React Native Web), TypeScript**                                                                       | One codebase ships iOS and web. Native camera, local notifications, and App Store builds all supported.                                                                                              |
| Shared logic  | **`packages/core`** — pure TypeScript                                                                                        | Budget math, payoff schedules, rollover rules live here. Zero UI dependencies, fully unit-testable.                                                                                                  |
| Local data    | **SQLite (expo-sqlite) / IndexedDB on web**                                                                                  | Local-first. App is fully usable offline and in guest mode with no account.                                                                                                                          |
| Backend       | **Supabase** (Postgres + Auth + Storage + Row Level Security)                                                                | Handles sync, auth, and receipt image storage. Generous free tier. RLS means one user can never read another's rows.                                                                                 |
| AI            | **Claude API** via server-side Supabase Edge Functions                                                                       | Receipt extraction, pantry scans, Budget Helper. Key never touches the device. Per-feature model choice, see below.                                                                                  |
| Notifications | **expo-notifications, scheduled locally**                                                                                    | Bill reminders fire offline, no server needed.                                                                                                                                                       |
| Payments      | **Stripe** (web, test mode) via Supabase Edge Functions; **RevenueCat** (native) deferred pending an Apple Developer account | Checkout, billing portal, and webhook-synced entitlements are real and tested against Stripe test mode — see `docs/stripe-setup.md`. Nothing is stubbed on web; native purchasing doesn't exist yet. |

### Why not the alternatives

- **Native SwiftUI + separate React web:** best iOS feel, roughly double the work and two codebases to keep in sync. Not worth it for v1.
- **Flutter:** one codebase, but web output is heavier and less accessible — a problem given this audience.

### AI specifics

Model IDs verified against current Anthropic API docs in Phase 6 (not the same models named when this plan was first drafted) and centralized in `supabase/functions/_shared/ai-config.ts` — nothing else in the codebase hardcodes a model string.

- **Receipt extraction:** `claude-sonnet-5` with image input, a forced tool call with a strict JSON schema so the app always gets parseable line items. The user reviews and corrects everything before it saves (screen #45) — the AI never writes to the budget directly.
- **Pantry scan:** `claude-haiku-4-5` — lower-stakes suggestion list, cheaper model, same never-auto-saves rule.
- **Budget Helper (Budget Buddy):** `claude-sonnet-5`, with a system prompt that enforces the non-judgmental tone and hard-blocks investment/tax/legal advice, redirecting to a licensed professional instead. Chat history is not persisted (client-side state only), which is also how "delete my chat history" is satisfied.
- **Missions:** not yet built (deferred out of Phase 6 — see `IMPLEMENTATION_CHECKLIST.md`'s Phase 6 section); doesn't need AI to begin with.
- **Cost control:** every AI action is checked against `packages/core`'s `FEATURE_REGISTRY` limits server-side _before_ the Claude call runs, so an over-limit request never reaches (or costs) the API — verified live, not just in theory.

### Testing without real money

- Every feature works against a **seeded dummy dataset** — a realistic biweekly-paid household with 8 bills, 2 credit cards, a car loan, a mortgage, 2 savings goals, and 3 months of transaction history.
- **No Plaid, no bank credentials, no live payments** in the testing stage. Bank balance is a number the user types in.
- Guest/Demo mode loads the dummy data instantly with a "Reset demo data" button.

---

## 3. Complete page inventory

**72 screens across 10 sections.** Mobile uses a 5-tab bar; web uses a left sidebar with the same sections in wider layouts.

**Mobile tab bar:** Home · Plan · Bills · Money (debt + savings) · Helper
_(Settings lives behind the avatar in the header.)_

### A. Onboarding & Account — 10 screens

| #   | Screen                               | What it does                                                 |
| --- | ------------------------------------ | ------------------------------------------------------------ |
| 1   | Welcome / Splash                     | Logo, one-line promise, "Get started" / "Try the demo"       |
| 2   | How it works                         | 3 cards: See your money → Plan each paycheck → Get ahead     |
| 3   | Sign up / Log in / Continue as guest | Email + password, Apple Sign In, guest mode                  |
| 4   | Setup 1 — How do you get paid?       | Hourly, salary, fixed income (SSI/pension), variable/tips    |
| 5   | Setup 2 — Pay schedule               | Weekly / biweekly / twice monthly / monthly + next payday    |
| 6   | Setup 3 — Starting balances          | Bank balance, cash on hand                                   |
| 7   | Setup 4 — Your first 3 bills         | Quick-add with common bill suggestions                       |
| 8   | Setup 5 — Pick one goal              | Emergency fund / pay off a card / stop overdrafting          |
| 9   | You're all set                       | Summary of what was entered + "Here's your dashboard"        |
| 10  | Demo mode banner                     | Persistent "You're in demo mode — Create an account to save" |

### B. Dashboard — 4 screens

| #   | Screen                        | What it does                                                                                                                                                                      |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | **Home dashboard**            | Total income, bank balance, upcoming bills, total expenses, savings, debt balances, **money left to spend**. Auto-recalculates on every change. Progress bars + spending summary. |
| 12  | Safe-to-Spend breakdown       | Shows exactly how the "left to spend" number was calculated, line by line                                                                                                         |
| 13  | Month overview                | Spending by category with simple bars, month-over-month comparison                                                                                                                |
| 14  | Alerts & notifications center | Bills due soon, goals hit, missions available                                                                                                                                     |

### C. Monthly & Paycheck Budgeting — 9 screens

| #   | Screen                     | What it does                                                                              |
| --- | -------------------------- | ----------------------------------------------------------------------------------------- |
| 15  | Budget month view          | Planned vs. actual per category, running totals                                           |
| 16  | Paycheck list              | Every paycheck this month with amount assigned / unassigned                               |
| 17  | **Assign this paycheck**   | Drag or tap to split a paycheck across bills, groceries, savings, debt, allowances, other |
| 18  | Category detail            | Planned, actual, remaining, and the transactions inside it                                |
| 19  | Add / Edit category        | Name, planned amount, type, color                                                         |
| 20  | Add / Edit income          | Source, amount, frequency, next date                                                      |
| 21  | Variable income helper     | Enter a low / expected / high estimate; plan against the low number                       |
| 22  | Month close-out & rollover | Carries unpaid balances and leftover amounts into next month                              |
| 23  | Plan vs. actual report     | Where you planned well and where it drifted                                               |

### D. Monthly Bills — 6 screens

| #   | Screen               | What it does                                                       |
| --- | -------------------- | ------------------------------------------------------------------ |
| 24  | Bills list           | Grouped: Overdue · Due soon · Upcoming · Paid                      |
| 25  | Bill detail          | Amount due, due date, status, full payment history                 |
| 26  | Add / Edit bill      | Name, amount, due date, recurrence, category, autopay flag         |
| 27  | **Record a payment** | Supports partial payments and multiple payments per bill per month |
| 28  | Bill calendar        | Month grid with bill dots and paydays marked                       |
| 29  | Reminder settings    | Default 3 days before due; per-bill override                       |

### E. Credit Cards, Loans & Mortgages — 7 screens

| #   | Screen                          | What it does                                                                        |
| --- | ------------------------------- | ----------------------------------------------------------------------------------- |
| 30  | Debt overview                   | Total owed, total paid down, overall progress bar                                   |
| 31  | Debt account detail             | Balance, credit limit, APR, minimum payment, due date, utilization, payment history |
| 32  | Add / Edit debt account         | Type (card / loan / mortgage), balance, limit, APR, minimum, due date               |
| 33  | Record payment / Update balance | Multiple payments per month supported                                               |
| 34  | **Payoff plan builder**         | Snowball vs. avalanche side by side — shows total interest and payoff date for each |
| 35  | Payoff schedule                 | Month-by-month timeline of the chosen plan                                          |
| 36  | Credit utilization view         | Per-card and overall utilization with plain-language guidance                       |

### F. Savings Goals — 6 screens

| #   | Screen                      | What it does                                                                           |
| --- | --------------------------- | -------------------------------------------------------------------------------------- |
| 37  | Savings overview            | All goals, total saved, combined progress                                              |
| 38  | Goal detail                 | Progress bar, milestones, running total, projected completion date                     |
| 39  | Add / Edit goal             | Name, target amount, target date, deposit frequency                                    |
| 40  | Add deposit / withdrawal    | Log money in or out with a note                                                        |
| 41  | **52-Week Challenge setup** | Customizable: classic ascending, flat amount, reverse, or your own; weekly or biweekly |
| 42  | 52-Week Challenge tracker   | 52-square grid, tap to mark complete, running total                                    |

### G. Grocery & Receipt Tracking — 9 screens

| #   | Screen                          | What it does                                                                                             |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 43  | Receipts list                   | All scanned receipts, grocery spending trend                                                             |
| 44  | Scan receipt (camera)           | Photo or upload; guide frame for alignment                                                               |
| 45  | **Review & correct extraction** | Editable table of store, date, items, categories, prices, tax, total — **nothing saves until confirmed** |
| 46  | Receipt detail                  | Saved receipt with its budget impact                                                                     |
| 47  | Pantry / fridge scan            | Photo of shelves or fridge                                                                               |
| 48  | Suggested grocery list          | Generated from what's missing, editable                                                                  |
| 49  | Meal ideas                      | Simple meals from what you already have                                                                  |
| 50  | Grocery list                    | Manual checkable list, running estimated total                                                           |
| 51  | Grocery spending insights       | Category breakdown, price-per-trip trend                                                                 |

### H. AI Budget Helper & Missions — 5 screens

| #   | Screen                            | What it does                                                                                                                         |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 52  | **Helper chat**                   | Plain-language Q&A grounded in the user's own numbers. No judgment, no jargon.                                                       |
| 53  | Missions library                  | Build a starter emergency fund · Cut grocery spending · Pay off a card · Get ready for next month's bills · Stop the overdraft cycle |
| 54  | Mission detail                    | Small steps, progress, encouragement                                                                                                 |
| 55  | Mission complete                  | Celebration + what changed in your numbers                                                                                           |
| 56  | Free-usage meter / upgrade prompt | "1 of 2 free scans used" with a soft upgrade path                                                                                    |

### I. Reports & Data — 5 screens

| #   | Screen                    | What it does                         |
| --- | ------------------------- | ------------------------------------ |
| 57  | Reports hub               | Cards linking to each report         |
| 58  | Spending by category      | Selectable time range                |
| 59  | Income vs. expenses trend | Simple line/bar over months          |
| 60  | Debt & savings progress   | Combined "getting ahead" view        |
| 61  | **Export**                | CSV and JSON, all data or by section |

### J. Settings, Account & Subscription — 11 screens

| #   | Screen                              | What it does                                       |
| --- | ----------------------------------- | -------------------------------------------------- |
| 62  | Profile                             | Name, email, pay schedule, currency                |
| 63  | Subscription & plan                 | Current plan, what's included                      |
| 64  | **Paywall / Upgrade**               | Free vs. Premium comparison, 14-day trial CTA      |
| 65  | Trial started / Manage subscription | Days remaining, cancel instructions                |
| 66  | Household sharing _(Premium)_       | Invite a partner, shared vs. private categories    |
| 67  | Notification settings               | Bill reminders, payday reminders, goal milestones  |
| 68  | Security                            | Face ID / passcode lock, change password           |
| 69  | Data & privacy                      | Export, delete account, what we store              |
| 70  | Manage categories                   | Add, rename, reorder, archive                      |
| 71  | Help, FAQ, legal                    | **Includes the disclaimer**, terms, privacy policy |
| 72  | Reset demo data                     | Restore the dummy dataset                          |

### Web-only additions

- **Marketing landing page** (public, pre-login)
- **Sidebar shell** — same sections, wider two-column layouts
- **Bulk edit tables** — edit many bills or transactions at once
- **Drag-and-drop receipt upload** (instead of camera)
- **Full-year calendar view**
- **CSV import** for bringing in existing data

---

## 4. Data model (core tables)

```
users · households · household_members
accounts (bank/cash)          income_sources        paychecks
budget_periods                categories            budget_lines (planned)
transactions (actual)         bills                 bill_payments
debts                         debt_payments         payoff_plans
goals                         goal_deposits         challenge_weeks
receipts                      receipt_items         pantry_scans
grocery_lists                 grocery_items
missions                      user_missions         ai_usage
subscriptions / entitlements  settings              sync_metadata
```

**Key rules baked into the schema:**

- Every row carries `user_id` / `household_id`; Postgres RLS enforces isolation.
- Soft deletes (`deleted_at`) so nothing is lost by accident.
- `updated_at` + a client-side change log drive last-write-wins sync between mobile and web.
- Money stored as **integer cents**, never floats.

---

## 5. Free vs. Guided vs. Budget Buddy

_Updated post-audit — see the pricing research and product decisions log in `IMPLEMENTATION_CHECKLIST.md`._

|                                                  | Free ($0)                  | Guided ($5.99/mo · $49.99/yr) | Budget Buddy ($9.99/mo · $79.99/yr, 14-day trial) |
| ------------------------------------------------ | -------------------------- | ----------------------------- | ------------------------------------------------- |
| Dashboard, budgeting, bills, calendar            | ✅ Full                    | ✅ Full                       | ✅ Full                                           |
| Debt tracking + snowball/avalanche               | ✅ Basic                   | ✅ Basic                      | ✅ + Advanced side-by-side scenarios              |
| Savings goals + 52-week challenge                | Up to 2 goals              | ✅ Unlimited                  | ✅ Unlimited                                      |
| Receipt scans                                    | 2 total (lifetime)         | 5 / month                     | 30 / month                                        |
| Pantry scans & meal ideas                        | 1 total (lifetime)         | 2 / month                     | 15 / month                                        |
| Budget Buddy (AI assistant — text + photo in v1) | 3 actions total (lifetime) | 20 actions / month            | 150 actions / month                               |
| Budget Missions                                  | 2 total (lifetime)         | 5 / month                     | ✅ Full library, unlimited                        |
| Reports                                          | Basic                      | ✅ Full                       | ✅ Full + export                                  |
| Household sharing                                | —                          | —                             | — (deferred out of v1; individuals-only launch)   |
| CSV / JSON export                                | ✅                         | ✅                            | ✅                                                |

**Why these numbers:** every named competitor (YNAB $109/yr, Monarch $99.99/yr, Copilot $95/yr, EveryDollar $79.99/yr, PocketGuard $74.99/yr, Goodbudget $80/yr) charges more than Own My Budget's top tier — deliberate, since the target user is price-sensitive and has likely bounced off a pricier app before. Budget Buddy is the flagship upgrade reason; pantry scanning and Missions stay present at every paid tier but capped, not the headline. No tier — including Budget Buddy — is ever literally unlimited on AI usage; every action is metered server-side against `packages/core`'s `FEATURE_REGISTRY` (`packages/core/src/resources.ts`), the single source of truth these limits are read from.

The free tier is still genuinely useful on its own — someone can run their whole budget for free.

---

## 6. Build phases

| Phase | What ships                                         | Screens       |
| ----- | -------------------------------------------------- | ------------- |
| **0** | Design system, navigation shell, dummy-data engine | Foundation    |
| **1** | Dashboard + budgeting + income/paychecks           | 11–23         |
| **2** | Bills, calendar, reminders                         | 24–29         |
| **3** | Debt tracking + payoff plans                       | 30–36         |
| **4** | Savings goals + 52-week challenge                  | 37–42         |
| **5** | Receipts + pantry AI                               | 43–51         |
| **6** | Budget Helper + Missions                           | 52–56         |
| **7** | Accounts, sync, export                             | 61, 62, 68–72 |
| **8** | Onboarding polish + subscription (stubbed)         | 1–10, 63–67   |
| **9** | Accessibility audit, App Store prep, web launch    | All           |

**After Phase 0 and before each subsequent phase, I'll show you a preview of the screens and get your approval before building them out.**

---

## 7. Things I'd flag before we start

1. **Household sharing has real complexity** — two people editing the same budget needs conflict rules. I'd recommend keeping it Premium and shipping it in a later phase rather than Phase 8.
2. **Receipt extraction accuracy varies** with photo quality. The mandatory review-and-correct screen (#45) is what makes this safe — the AI never writes to the budget unreviewed.
3. **App Store review** for finance apps is stricter about subscriptions. Stubbing payments during testing is right, but budget extra time for review when you go live.
4. **The 52-week challenge as a savings goal** — I've modeled it as a special goal type rather than a separate system, so it shares progress tracking and deposits with regular goals. Simpler to build and to understand.

---

## 8. Decisions from Phase 0 (resolved)

1. **Stack** — Expo (React Native + Web), one codebase. Confirmed.
2. **Backend** — Supabase. Confirmed; org/project setup happens in Phase 2.
3. **Launch platforms** — Web + iOS for v1 (not Android at launch). US-only region.
4. **Branding** — blue/teal primary (from the approved Claude Design canvas), purple reserved as the Budget Buddy (AI) / premium accent. Full palette in `apps/mobile/src/constants/theme.ts`.
5. **Pricing & tiers** — Free / Guided ($5.99/mo) / Budget Buddy ($9.99/mo) — see §5 above.
6. **Household sharing** — deferred out of v1 (individuals-only launch).
7. **Budget Buddy scope for v1** — text + photo (receipt/pantry) only; voice input is a documented fast-follow, not in v1 (Claude's API takes text/images, not audio — voice would need a separate speech-to-text integration).

Remaining open items (not blocking development, tracked in `IMPLEMENTATION_CHECKLIST.md`): final logo/app icon, domain connection, support email, Apple Developer + Google Play Console accounts, Terms of Service / Privacy Policy.

---

_Own My Budget provides educational budgeting tools and general information. It does not provide financial, investment, tax, accounting, or legal advice._
