// Single source of truth for which Claude model each AI feature uses.
// Verified against current Anthropic model docs (2026-09-04) — never
// hardcode a model string anywhere else in these functions.
export const RECEIPT_SCAN_MODEL = 'claude-sonnet-5';
export const PANTRY_SCAN_MODEL = 'claude-haiku-4-5';
export const BUDGET_BUDDY_MODEL = 'claude-sonnet-5';

export const MAX_TOKENS_EXTRACTION = 4096;
export const MAX_TOKENS_CHAT = 2048;
