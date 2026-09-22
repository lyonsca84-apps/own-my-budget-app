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

/** "Aug 14" — or "Aug 14, 2025" when it isn't this year. */
export function formatActivityDate(iso: string): string {
  const date = parseLocalDate(iso.slice(0, 10));
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "1,234.50" / "$25" -> cents, or null when it isn't a non-negative amount. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Cents -> an editable dollar string ("25", "25.5"). */
export function centsToInput(cents: number | null | undefined): string {
  if (!cents) return '';
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

/** "$5,315" for whole-dollar amounts and "$1,234.50" otherwise — the design drops empty cents. */
export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
