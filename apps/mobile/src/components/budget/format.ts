import { parseLocalDate } from '@own-my-budget/core';

/** "2026-09-26" -> "Sat, Sep 26" (local calendar date, never shifted by timezone). */
export function formatPayday(dateOnly: string): string {
  return parseLocalDate(dateOnly).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
