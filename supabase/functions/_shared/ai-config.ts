// Single source of truth for which Claude model each AI feature uses.
// Verified against current Anthropic model docs (2026-09-04) — never
// hardcode a model string anywhere else in these functions.
export const RECEIPT_SCAN_MODEL = 'claude-sonnet-5';
export const PANTRY_SCAN_MODEL = 'claude-haiku-4-5';
export const BUDGET_BUDDY_MODEL = 'claude-sonnet-5';
// Structured extraction for the Phase 2 orchestration loop (ai-orchestrate) —
// same accuracy bar as receipt scanning, since this also feeds a financial
// record a user will review.
export const ORCHESTRATOR_MODEL = 'claude-sonnet-5';

export const MAX_TOKENS_EXTRACTION = 4096;
export const MAX_TOKENS_CHAT = 2048;
// A spoken Budget Buddy reply is 2–4 sentences (see budget-buddy-chat's
// voice mode) — a much lower ceiling keeps both the reply and the
// text-to-speech call that follows it short.
export const MAX_TOKENS_VOICE_CHAT = 400;
export const MAX_TOKENS_ORCHESTRATOR = 1024;
