# AI (Budget Buddy, receipts, pantry scans) setup

## Status: fully working, verified live

Three Supabase Edge Functions are deployed and live against the real project (`soapkqeaodjawxrvslob`): `receipt-scan`, `pantry-scan`, `budget-buddy-chat`. All three verify the caller's session server-side, enforce `packages/core`'s `FEATURE_REGISTRY` usage limits before spending any tokens, and record usage only after a successful Claude response. `ANTHROPIC_API_KEY` is set as an Edge Function secret and Anthropic billing is active — confirmed by real, live requests returning real Claude responses for all three functions (not just reaching the code, an actual model response), with `feature_usage` incrementing correctly and being cleaned up after each test.

## `ANTHROPIC_API_KEY`

Every AI feature (Budget Buddy chat, receipt scanning, pantry scanning) calls Claude from inside these Edge Functions — never from the client, per the project's security rules. If this secret is ever unset or the underlying Anthropic account runs out of credits, every AI request fails with a generic 500 ("Something went wrong…") after passing auth and usage checks — that's the expected, safe failure mode, not a bug, and the two most likely causes if it ever recurs.

Set it via the Supabase dashboard (Project Settings → Edge Functions → Secrets) or the CLI (`supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref soapkqeaodjawxrvslob`) — never paste an API key into chat with an AI assistant, including this one. No redeploy is needed after setting it — Edge Functions read secrets from the environment at request time.

**If a request ever fails again:** check first whether it's the key (unset/revoked) or Anthropic account billing (out of credits) — those are the two failure modes actually seen during this project's setup, both surfacing as the same generic 500 from the client's perspective.

## Models (centralized in `supabase/functions/_shared/ai-config.ts`)

| Feature           | Model              | Why                                                                                                                                                            |
| ----------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receipt scan      | `claude-sonnet-5`  | Vision + structured extraction; accuracy matters since it's money data (though the mandatory review-and-correct screen is the real safety net, not the model). |
| Pantry scan       | `claude-haiku-4-5` | Lower-stakes suggestion list; cheaper model since the free tier only gets 1 lifetime scan.                                                                     |
| Budget Buddy chat | `claude-sonnet-5`  | The flagship AI feature — worth the better model.                                                                                                              |

Model IDs are current as of 2026-09-04. If Anthropic ships a newer generation, update `ai-config.ts` only — nothing else references a model string.

## Usage limits

Enforced server-side in `supabase/functions/_shared/feature-limits.ts`, duplicated from `packages/core/src/resources.ts`'s `FEATURE_REGISTRY` (Edge Functions run on Deno and can't import the npm workspace package). **If you change a limit in `resources.ts`, update `feature-limits.ts` to match** — there's no automated sync between them.

## Budget Buddy chat history

Not persisted server-side or in any database table. The client (`apps/mobile/src/app/(tabs)/helper.tsx`) keeps the conversation in local component state only, so leaving the screen or tapping "Clear chat" discards it completely. This is a deliberate v1 scope decision, not an oversight: it satisfies "give users a way to delete their chat history" trivially, without a new table, retention policy, or deletion UI.

## Scope cuts from PLAN.md's screens 43–56

Built this phase: scan receipt → review & correct → save (#44–46), pantry scan → review → grocery list (#47–48, #50), Budget Buddy chat. **Not built**: the Missions library (#52–55, doesn't need AI — static content + progress tracking, better suited to its own phase), meal ideas (#49), grocery spending insights (#51), and a dedicated receipts list/detail screen (#43, 46) — `listReceipts` exists in `packages/api` but nothing renders it yet.
