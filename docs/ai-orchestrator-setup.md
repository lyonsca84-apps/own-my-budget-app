# AI orchestration layer (Claude + Jev)

## Status: Phase 1 + Phase 2 complete — observation mode, all flags OFF by default

This adds a second AI system alongside the existing Claude-only features (Budget Buddy, receipt scan, pantry scan — see `docs/ai-setup.md`, unchanged). **Jev** (`typesafe/jev-1.13`, called via OpenRouter's Decisions API) is a fast, typed classifier: it returns a value + confidence from a fixed allowlist, never prose, and never touches the database or does arithmetic. Claude remains the only model that writes prose, parses dates, or will (in Phase 2) propose an action for a human to confirm.

Nothing in Phase 1 changes onboarding, auth, Stripe, RLS, financial calculations, or any existing screen. No new UI was added. Every new code path is behind a feature flag that defaults off.

## Architecture

- **`packages/ai-orchestrator`** (new npm workspace, Jest-tested) — the Source of Truth for decision types, response validation, confidence-policy thresholds, redaction/injection pre-filters, and the circuit-breaker state machine. Zero I/O, runs in both Node (tests) and conceptually in Deno.
- **`supabase/functions/_shared/{flags,jev-decisions,jev-client,redact,confidence-policy,circuit-breaker}.ts`** — Deno-side Edge Function code. These hand-maintain a small duplicate of the same enums/logic as `packages/ai-orchestrator`, because **Deno Edge Functions can't import npm workspace packages at deploy time** (the same constraint `supabase/functions/_shared/feature-limits.ts` already works around by duplicating `packages/core`'s `FEATURE_REGISTRY`). If you change a decision type or threshold, update both places.
- **`supabase/functions/intent-router/index.ts`** — the one new live endpoint. Classifies `user_intent` only; never writes, never calls Claude.
- **`packages/api/src/queries/edge-functions.ts`**'s new `routeIntent()` — the typed client wrapper, following the exact convention already used for `sendBudgetBuddyMessage`/`scanReceipt`/etc. **Not wired into any screen yet** — this is the entry point a future voice/text quick-add UI would call.

## Phase 2 — the complex-task loop

Adds the reusable **Claude → protected tool → Jev evaluation → Claude revision** loop, capped at `AI_ORCHESTRATOR_MAX_LOOPS` (default 3) total Claude attempts, implementing exactly one concrete workflow: extracting a proposed bill payment from free text — the task brief's own worked example ("I paid Georgia Power $75 yesterday."). Gated entirely by `JEV_ORCHESTRATOR_ENABLED` (default off).

**New pure logic** (`packages/ai-orchestrator`, Jest-tested, 50 new tests):

- `loopController.ts` — the state machine enforcing the three-attempt maximum. `revise` only continues while attempts remain; every other signal (`pass`, `needs_user_confirmation`, `needs_human_review`, `unsupported`, `error`, `low_confidence`) resolves immediately to a terminal, safe outcome. Never loops unboundedly.
- `confirmationToken.ts` — stateless HMAC-signed (Web Crypto) proposal-integrity tokens.
- `spokenDate.ts` — deterministic date parsing (today/yesterday/"N days ago"/ISO/slash/month-name formats), always using local-midnight `Date` construction per `packages/core/src/dates.ts`'s documented UTC-parsing trap. Returns `null` rather than guessing on anything unparseable.
- `billMatch.ts` — deterministic bill-name matching (exact → substring → Levenshtein-distance fuzzy match) against the caller's own bills.
- `toolRegistry.ts` — the server-controlled allowlist of protected tools; currently one entry, `lookup_matching_bill`, explicitly marked read-only.
- A fifth Jev workflow, `record_bill_payment_evaluation` (`workflow_status` decision kind), added to `workflows.ts`/`jev-decisions.ts`.

**Deno side**: hand-maintained duplicates of all the above (`loop-controller.ts`, `confirmation-token.ts`, `spoken-date.ts`, `bill-match.ts`), plus `claude-client.ts` (a typed wrapper around the same `@anthropic-ai/sdk` already used by `budget-buddy-chat`, instructed explicitly **not** to do date math itself), and the one new Edge Function, `ai-orchestrate`.

### The loop, concretely

1. Auth + flag check + input validation + the same deterministic prompt-injection pre-filter as `intent-router`.
2. Look up the caller's own bills (read-only — the one "protected tool" this phase implements).
3. **Claude** extracts `{bill_name, amount_dollars, spoken_date}` as strict JSON — told explicitly never to convert the date itself.
4. **Application code** deterministically validates: bill-name match (`billMatch.ts`), amount sanity (positive, under a $100,000 cap), date parse + non-future check (`spokenDate.ts`). Only small derived booleans/enums (e.g. `bill_match: fuzzy; amount_valid: true; date_valid: true; date_is_future: false`) — never the raw amount, date, or bill name — are sent to Jev or logged.
5. **Jev** evaluates those derived signals against `record_bill_payment_evaluation`'s narrow criteria, returning `pass | revise | needs_user_confirmation | needs_human_review | unsupported` + confidence. A `pass` at low confidence (per the same `DEFAULT_CONFIDENCE_THRESHOLDS` from Phase 1) is treated as `needs_human_review`, never blindly trusted.
6. `revise` sends Claude a deterministically-built reason (which signal failed) and loops, up to the cap; any other outcome, or running out of attempts, terminates safely.
7. **This function never writes anything.** A terminal `pass`/`needs_user_confirmation` returns a proposal (bill id, amount, date) plus a signed confirmation token for future tamper-evidence; `needs_human_review`/`max_loops_reached` returns a clear review-required result with no token. `packages/api`'s new `proposeBillPayment()` is the typed client wrapper — **not wired into any screen.**

### Why no write path exists yet (the scope decision this phase makes explicit)

The brief's "Only then may the protected server action save the record" is satisfied by **the existing, unmodified, RLS-protected manual-entry screen** (`record-bill-payment.tsx` → `recordBillPayment()`) — not a new AI-triggered write endpoint. A future UI would pre-fill that existing screen from a proposal and let the user review/edit/tap Save exactly as they do today; that tap is the real "visible user confirmation before creating a financial record." Building a second, token-gated write path with no UI to drive it was judged out of scope for this phase — `confirmationToken.ts` exists and is tested so that path is ready to wire up later, but it gates nothing today. This keeps the blast radius of Phase 2 to zero changes in how any financial record actually gets saved.

### Metering

A new `aiOrchestration` key (same `feature_usage` table, same pattern as Phase 1's `jevDecision`) meters one unit per completed orchestration _run_ (regardless of how many internal Claude attempts it took), recorded only once a real Claude call succeeded — never on a request that fails before reaching Claude. Each Jev call _within_ the loop is separately metered under the existing `jevDecision` key, shared with `intent-router`. Migration `20261004130000_ai_orchestration_usage_key.sql` widens the same CHECK constraint again — not applied, same as Phase 1's migration.

### Known gaps (Phase 2)

Same Deno-test-runner gap as Phase 1 — `claude-client.ts` and `ai-orchestrate/index.ts`'s actual Claude/HTTP behavior is reviewed, not automated-tested, for the same reason (no Deno test runner wired into this repo, and this isn't deployed). The Levenshtein-based fuzzy bill matching and the spoken-date parser cover common cases but are not exhaustive NLU — genuinely ambiguous input correctly routes to `needs_user_confirmation`/`needs_human_review` rather than guessing, which is the safety property that matters, but don't expect it to parse every possible phrasing.

## Setup

```
npm run setup:openrouter
```

Walks you through creating a key at `openrouter.ai/keys`, reviewing OpenRouter's privacy settings (Zero Data Retention / deny data collection for training, at `openrouter.ai/workspaces/default/settings`), and pasting the key into a masked prompt. It validates the key with one minimal `GET /api/v1/key` request, writes it only to the local root `.env` (never `apps/mobile/.env` — that would ship it in the client bundle), confirms `.env` is `.gitignore`-excluded first, sets `chmod 600`, and never echoes or logs any part of the key. **Never paste the key into a chat with Claude or any AI assistant, and never commit it.**

This project keeps server secrets in root `.env` (matching `ANTHROPIC_API_KEY`'s existing convention), not `.env.local` — the setup script targets the file this project actually uses.

## Feature flags

All read from `supabase/functions/_shared/flags.ts`, all default to the safe/off value if unset:

| Flag                        | Default | Gates                                                                                                                      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `JEV_ORCHESTRATOR_ENABLED`  | `false` | Reserved for the Phase 2 Claude↔tool↔Jev loop — not read by any Phase 1 code yet.                                          |
| `JEV_VOICE_ROUTING_ENABLED` | `false` | `intent-router`. When `false`, the function returns `{ status: 'disabled' }` immediately, after auth — it never calls Jev. |
| `JEV_ONBOARDING_ENABLED`    | `false` | Reserved, documented-only — see "Future integrations" below. Not read by any code path that touches onboarding.            |
| `AI_ORCHESTRATOR_MAX_LOOPS` | `3`     | Reserved for Phase 2's loop cap.                                                                                           |

Set any of these as a Supabase Edge Function secret (`supabase secrets set JEV_VOICE_ROUTING_ENABLED=true --project-ref <ref>`) to turn it on for real traffic, or in your local `.env` for `supabase functions serve`. Flipping a flag back to `false` (or leaving it unset) is a complete, instant rollback of everything that flag gates — no code deploy required.

## Privacy & safety boundaries

- `intent-router` sends only the raw text the user typed/spoke — never a budget snapshot, never account balances — and redacts card/account numbers, SSNs, and email addresses (`redactSensitivePatterns`) before that text reaches Jev or any log line.
- A deterministic phrase-based pre-filter (`looksLikePromptInjection`) blocks obvious prompt-injection attempts before any model call, returning `{ status: 'blocked', reason: 'possible_prompt_injection' }`.
- Logs (`jev-client.ts`'s `logSafe`) are built from an explicit field allowlist — request id, workflow name, latency, confidence, HTTP status — and can never contain the raw input text, a prompt, or the API key, by construction (the log function's signature doesn't accept those fields).
- Nothing in Phase 1 can create, edit, or delete a financial record. `intent-router` only ever returns a classification + confidence; no "confirm" flow exists yet because there is nothing yet to confirm.

## Confidence policy

`DEFAULT_CONFIDENCE_THRESHOLDS` (in both `packages/ai-orchestrator/src/confidencePolicy.ts` and its Deno duplicate) are **placeholder starting values, not yet calibrated against real Own My Budget usage.** Before relying on them for anything consequential (Phase 2+), calibrate against a labeled set of real Own My Budget voice/text phrases and adjust per-workflow — the thresholds are a plain config object, editable without touching any orchestration logic.

## Rate limiting

`intent-router` reuses the existing AI-usage-metering pattern (`feature_usage` table, `assertUnderLimit`/`recordUsage`, same as `budget-buddy-chat`) under a new `jevDecision` key — see `supabase/functions/_shared/feature-limits.ts` and migration `20261004120000_ai_orchestrator_usage_key.sql`. **This migration file exists but has not been applied to any database** (per "do not deploy") — apply it yourself with `supabase db push` or via the dashboard when ready; `JEV_VOICE_ROUTING_ENABLED` must stay `false` until it's applied, or the function's `assertUnderLimit`/`recordUsage` calls will fail against the old CHECK constraint.

**Known gap:** there is no per-IP rate limiting — this codebase has no existing IP-tracking infrastructure to reuse, and the task's "reuse existing infrastructure" instruction ruled out inventing new state for it. Per-user limits (above) and the circuit breaker are the real guardrails for now; per-IP limiting would need either a Supabase/platform-level feature or new state, and is an open risk to revisit before this leaves observation mode for real users.

## Resilience (the Jev client)

`jev-client.ts`: 8s timeout via `AbortController`, a closed/open/half-open circuit breaker (opens after 3 consecutive failures, half-opens after 30s), explicit 429 handling, and a safe `{ ok: false, reason }` return on every failure path — it never throws. The circuit breaker is **in-memory per warm Edge Function instance** and resets on cold start, since Supabase Edge Functions are stateless across instances; the `JEV_*` feature flags are the durable, instance-independent kill switch. If Jev is disabled, circuit-open, timed out, rate-limited, or returns anything that fails validation, `intent-router` returns `{ status: 'fallback', reason }` — the client should treat this exactly like the feature not existing (fall back to manual entry).

## Testing

- `packages/ai-orchestrator`: 52 Jest tests covering decision validation (valid/invalid/incomplete responses), confidence-policy banding (including "consequential actions always require confirmation, even at high confidence"), redaction (61 labeled phrases including misspellings, hourly-pay/fixed-income/retirement/family-budget language, card/account/SSN/email numbers, and 4 prompt-injection attempts), and the circuit-breaker state machine (opening on repeated failures, half-open recovery, reopening on a failed trial).
- `packages/api`: `routeIntent()` unit tests (mocked `functions.invoke`) plus the existing guest-mode smoke-test coverage guard, extended to include `routeIntent`.
- **Known gap, not introduced by this work:** this project has no Deno test runner wired up (neither locally nor in `.github/workflows/ci.yml`), and none of the three existing AI Edge Functions (`budget-buddy-chat`, `receipt-scan`, `pantry-scan`) have automated tests either. `jev-client.ts` and `intent-router/index.ts`'s actual HTTP/Deno-runtime behavior is therefore verified by code review and manual testing (below), not by an automated suite — the logic that _can_ be isolated as pure functions (validation, confidence policy, redaction, circuit breaker) is the part that's Jest-tested, by design.
- Live API tests against the real OpenRouter endpoint were not run — `OPENROUTER_API_KEY` isn't set in this environment, and per the task's own instructions, live tests must be optional/skipped without a key, not run as part of normal CI.

### Manual local test (once you've run `npm run setup:openrouter` and set `JEV_VOICE_ROUTING_ENABLED=true` for local `supabase functions serve`)

```bash
curl -X POST 'http://localhost:54321/functions/v1/intent-router' \
  -H "Authorization: Bearer <a real user session access token>" \
  -H 'Content-Type: application/json' \
  -d '{"text": "I paid Georgia Power $75 yesterday."}'
```

Expect `{"status":"recommendation","intent":"record_bill_payment",...}` once a real key + applied migration are in place, or `{"status":"disabled"}` with the flag off.

## Cost monitoring

Jev is billed per input token only (output tokens are free, per OpenRouter's docs) — far cheaper per call than a Claude chat turn. `jev-client.ts` returns `tokensUsed`/`costUsd` from OpenRouter's `usage` field on every successful call; `intent-router` doesn't currently persist these anywhere (no new table was added — see "Rollback" below for why), so cost visibility today is OpenRouter's own dashboard plus the structured `console.log` lines (`jev_success`, etc.), queryable via Supabase's Edge Function logs the same way existing AI feature costs are tracked per `docs/production-readiness.md`.

## Rollback

1. Set `JEV_VOICE_ROUTING_ENABLED=false` (or unset it) — `intent-router` immediately returns `{ status: 'disabled' }` for every request, with no code change or redeploy.
2. If you need to remove the code entirely: every new file is additive, and the only edits to pre-existing files (`feature-limits.ts`, `.env.example`, root `package.json`, `edge-functions.ts`, `guest-smoke.test.ts`) are additive (new keys/exports/test cases) — `git revert` of this phase's commit(s) is clean.
3. The migration (`20261004120000_ai_orchestrator_usage_key.sql`) is reversible by a follow-up migration dropping `'jevDecision'` from the CHECK constraint again, safe as long as no `feature_usage` row was ever written with that key (true while the flag stays off).

## Production configuration

Do **not** set `OPENROUTER_API_KEY` in chat or in any file that reaches source control. For a real deployment:

1. This key only ever needs to exist as a **Supabase Edge Function secret**: `supabase secrets set OPENROUTER_API_KEY=sk-or-... --project-ref <your-project-ref>` (same mechanism as `ANTHROPIC_API_KEY`, see `docs/ai-setup.md`). No redeploy is needed after setting a secret — Edge Functions read it from the environment at request time.
2. Set the four flags the same way, as Edge Function secrets, when you're ready to move a given workflow out of observation mode.
3. Apply the migration (`supabase db push` or via the dashboard) before setting `JEV_VOICE_ROUTING_ENABLED=true` anywhere real traffic reaches it.

Nothing above was executed as part of this work — no secret was set, no migration was applied, no function was deployed.

## Future integrations (documented only, not activated)

`JEV_ONBOARDING_ENABLED` exists as a reserved flag and is read by `flags.ts`, but **no onboarding code reads it or calls Jev in any way.** See **`docs/ai-orchestrator-future-integrations.md`** (Phase 3) for a full, codebase-grounded design sketch of this and five other integration points the original brief named — onboarding, Budget Missions, expense categorization, grocery categorization, support request routing, and Budget Buddy safety. None of them are activated; nothing in that document is called by any code.

## Files changed

**New — Phase 1:**

- `packages/ai-orchestrator/` (package.json, tsconfig.json, eslint.config.js, `src/{types,validate,confidencePolicy,redact,circuitBreaker,workflows,metadataLog,index}.ts`, `src/__tests__/{fixtures,validate,confidencePolicy,redact,circuitBreaker,workflows}.ts`)
- `supabase/functions/_shared/{flags,jev-decisions,jev-client,redact,confidence-policy,circuit-breaker}.ts`
- `supabase/functions/intent-router/index.ts`
- `packages/api/src/__tests__/edge-functions.test.ts`
- `scripts/setup-openrouter.mjs`
- `supabase/migrations/20261004120000_ai_orchestrator_usage_key.sql`
- `docs/ai-orchestrator-setup.md` (this file)

**New — Phase 2:**

- `packages/ai-orchestrator/src/{loopController,confirmationToken,spokenDate,billMatch,toolRegistry}.ts` + matching `src/__tests__/*.test.ts`
- `supabase/functions/_shared/{loop-controller,confirmation-token,spoken-date,bill-match,claude-client}.ts`
- `supabase/functions/ai-orchestrate/index.ts`
- `supabase/migrations/20261004130000_ai_orchestration_usage_key.sql`

**Edited (all additive):**

- `supabase/functions/_shared/feature-limits.ts` — added `jevDecision` (Phase 1), `aiOrchestration` (Phase 2)
- `supabase/functions/_shared/jev-decisions.ts` — added `record_bill_payment_evaluation` workflow (Phase 2)
- `supabase/functions/_shared/ai-config.ts` — added `ORCHESTRATOR_MODEL`, `MAX_TOKENS_ORCHESTRATOR` (Phase 2)
- `packages/ai-orchestrator/src/{workflows,index}.ts` — added the same workflow + new barrel exports (Phase 2)
- `packages/api/src/queries/edge-functions.ts` — added `routeIntent()` (Phase 1), `proposeBillPayment()` (Phase 2)
- `packages/api/src/__tests__/guest-smoke.test.ts` — added both to the coverage guard's call list
- root `package.json` — added `setup:openrouter` script
- root `.env.example` — documented the new env vars
