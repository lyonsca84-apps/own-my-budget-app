import { parseLocalDate } from '@own-my-budget/core';

/** "Sep 5, 2026" from a YYYY-MM-DD (or ISO timestamp) string. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return parseLocalDate(iso.slice(0, 10)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatWholeDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
