import type { PantryExtraction, ReceiptExtraction } from '@own-my-budget/api';

/**
 * Passes a scan result from its scan-*.tsx screen to its review-*.tsx
 * screen. A route param would need the whole extraction (plus a base64
 * image) URL-encoded, which is both wasteful and has practical length
 * limits — this in-memory handoff is simpler and fine for a same-process,
 * single-user native navigation stack.
 */
export const scanHandoff: {
  receipt?: { extraction: ReceiptExtraction; imageBase64: string; mediaType: string };
  pantry?: { extraction: PantryExtraction };
} = {};
