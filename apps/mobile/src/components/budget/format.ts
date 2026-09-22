import { parseLocalDate } from '@own-my-budget/core';

/** "2026-09-26" -> "Sep 26" (local calendar date, never shifted by timezone). */
export function formatPayday(dateOnly: string): string {
  return parseLocalDate(dateOnly).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
