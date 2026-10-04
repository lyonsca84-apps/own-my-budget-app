# AI orchestration layer — future integrations (Phase 3, documentation only)

**Nothing in this document is activated.** No code in this phase reads a new flag, calls Jev, calls Claude, or changes any screen, onboarding step, or database write. This is a design sketch for six integration points the original brief named, grounded in what actually exists in this codebase today, so a future phase can implement one deliberately and get it reviewed on its own — not a feature a flag quietly turns on.

Every integration below follows the same non-negotiable shape established in Phase 1/2 (see `docs/ai-orchestrator-setup.md`): Jev only ever returns a typed value + confidence from a fixed allowlist, derived/minimal state only ever reaches it, application code does every calculation and date comparison, nothing is ever saved without an explicit human confirmation, and every new code path starts behind a flag defaulting to off.

## 1. Onboarding

**Where it would plug in:** `apps/mobile/src/app/onboarding.tsx` — a 5-step wizard (You / Money in / Budget / Goals / Done) that already writes nothing to Supabase until the final `handleFinish()` call. `JEV_ONBOARDING_ENABLED` already exists as a reserved flag in `supabase/functions/_shared/flags.ts`, read by nothing today.

**What it could do**, per the original brief: recognize whether someone wants beginner or experienced guidance, route hourly-pay/fixed-income/retirement/family-budget setup toward the right follow-up questions, detect confusion from how someone answers, and categorize a spoken onboarding answer into one of the wizard's existing fields (e.g. `income_sources.frequency`).

**Hard constraints, carried over verbatim from the original brief — a future implementation must satisfy every one:** Jev must never accept legal consent for a user, skip a required onboarding step, calculate income, decide what a user should do financially, silently save an onboarding answer, or block onboarding because of an uncertain decision. In practice: every Jev call here would be a `user_intent`-style classification of free text the user already typed/spoke into an existing field (not a new consent or legal flow), the wizard's own `validateStep()` and `handleFinish()` remain the only thing that writes data, and an uncertain classification must fall back to the current behavior (ask the plain question) rather than ever blocking the Next button.

**Suggested first slice:** classify the free-text answer to "what's your income frequency/type" into the wizard's existing `Frequency` options (`weekly | biweekly | twice_monthly | monthly | variable`) as a pre-fill suggestion the user can still change — the same `applyConfidencePolicy` pattern already used for `user_intent`, reusing Phase 1's confidence-policy machinery with a new, separately-calibrated threshold.

## 2. Budget Missions

**Current state:** `packages/core/src/features/missions.ts` is a feature-gate wrapper only (`canStartMission`) — it checks plan-tier limits, nothing else. Per `docs/ai-setup.md`'s documented scope cuts, **the Missions content library itself (screens #52–55) hasn't been built yet** — "static content + progress tracking, better suited to its own phase." This integration point describes how Jev would plug into that library once it exists, not something implementable today.

**What it could do once the library exists:** given a user's derived financial situation (e.g. "has high-interest debt: true; has emergency fund: false; income is variable: true" — never raw balances), Jev classifies which mission category best fits right now, as a `choice` decision over the library's own mission-category keys (mirroring how `JEV_WORKFLOWS.user_intent`'s criteria are the allowlisted values today). The mission content itself stays static, authored content — Jev only ever picks which existing mission to surface next, never generates one.

## 3. Expense categorization

**Already half-built:** Phase 1 already defines the `expense_category` Jev decision kind and workflow (`housing | utilities | groceries | transportation | insurance | healthcare | debt_payment | savings | subscription | personal | entertainment | other | unclear`) in `packages/ai-orchestrator/src/workflows.ts` / `supabase/functions/_shared/jev-decisions.ts` — it's defined, tested (`workflows.test.ts`), and completely unused by any Edge Function today.

**Where it would plug in:** the `add-category.tsx` / `add-transaction.tsx` screens (and the `add_expense` intent `intent-router` already classifies in observation mode) are the natural caller. A new, small Edge Function (following `intent-router`'s exact shape) would take a short expense description, call Jev with the existing `expense_category` workflow, and return a suggested category — the user's existing category picker stays the actual write path, with the suggestion only ever pre-selecting (never auto-saving) a reversible choice, exactly like `applyConfidencePolicy`'s `preselect` action already models.

**Why this is the lowest-effort next integration:** no new Jev workflow definition is needed — it already exists and is tested. Only the Edge Function + a UI touchpoint would be new work.

## 4. Grocery categorization

**Where it would plug in:** `packages/api/src/queries/groceries.ts` (`addGroceryItems`, `listGroceryItems`) and the `grocery-list.tsx` / `scan-pantry.tsx` screens. `pantry-scan` already uses **Claude** (not Jev) today to extract visible/running-low items from a photo — that's unchanged.

**What it could add:** a `grocery_item_category` Jev workflow (new — not yet defined), classifying a short grocery item name into a small set of store-section categories (e.g. produce, dairy, pantry, household) for list sorting/grouping. This is a pure UX nicety, not a financial record — the lowest-stakes of all six integrations, since miscategorizing "milk" has no money-safety consequence the way a bill amount or date does. Still: never auto-reorders or auto-removes an item without the user seeing the change, per the project's general "suggestions are distinguishable from saved information" rule.

## 5. Support request routing

**Already partially modeled:** `app_help` and `feature_request` are both already-defined `user_intent` values that `intent-router` classifies today (in observation mode, unused downstream). `apps/mobile/src/app/settings.tsx` and `help-legal.tsx` are the existing in-app surfaces this would route toward.

**What it could do:** once `intent-router` is wired into a real UI entry point (Phase 1 built the function, not the screen), an `app_help` classification could deep-link to the relevant FAQ/settings section instead of a generic help screen, and a `feature_request` classification could route to wherever product feedback is currently collected (not built in this codebase today — would need its own decision first). No new Jev workflow is needed; this is purely a client-side routing decision on top of an existing classification.

## 6. Budget Buddy safety

**Where it would plug in:** `supabase/functions/budget-buddy-chat/index.ts` — already has a `SYSTEM_PROMPT` with explicit ground rules (no individualized investment/tax/legal advice, no shaming, no claimed ability to move money) and already handles Claude's own `stop_reason === 'refusal'` path today, entirely without Jev.

**What it could add:** Phase 1 already defines the `safety_classification` Jev decision (`ordinary | contains_sensitive_information | possible_prompt_injection | individualized_financial_advice_request | unsupported_or_out_of_scope`) but nothing calls it yet. A future version of `budget-buddy-chat` could run the user's message through this classification _before_ spending a Claude call: `contains_sensitive_information` or `possible_prompt_injection` could short-circuit to a canned safe response (cheaper and faster than a full Claude round-trip for the obvious cases), while `individualized_financial_advice_request` could be used to double-check Claude's own refusal behavior rather than replace it — Claude keeps the final say on what to actually say to the user, since Jev never generates prose.

**Why this is additive, not a replacement:** Claude's existing system-prompt-based refusal already works today (per `docs/production-readiness.md`'s "AI features: ... verified live") — this would be a cheaper, faster pre-filter layered in front of it, not a rewrite of the safety mechanism Budget Buddy already has.

## Common implementation checklist for any of the above

When one of these is actually picked up:

1. Add the new Jev workflow (if any) to **both** `packages/ai-orchestrator/src/workflows.ts` and `supabase/functions/_shared/jev-decisions.ts`, with its own test in `workflows.test.ts`.
2. Add its own entry to `DEFAULT_CONFIDENCE_THRESHOLDS` — never reuse another workflow's thresholds untuned.
3. Add a dedicated feature flag (not `JEV_ORCHESTRATOR_ENABLED`/`JEV_VOICE_ROUTING_ENABLED` — those are already spoken for) defaulting to `false`, read from `flags.ts`.
4. Start in observation mode exactly like `intent-router`: return a recommendation, never act on it automatically.
5. If the integration can ever lead to a write, it goes through the existing, unmodified write path and existing human confirmation UI — never a new AI-triggered save, per the precedent set in Phase 2's `ai-orchestrate`.
6. Calibrate thresholds against real, labeled Own My Budget examples before leaving observation mode — not before.
