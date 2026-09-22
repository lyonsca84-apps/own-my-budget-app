import { parseLocalDate } from '@own-my-budget/core';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

/** "2026-09-05" -> "Sep 5" (local calendar date, never shifted by timezone). */
export function formatMonthDay(dateOnly: string): string {
  const date = parseLocalDate(dateOnly.slice(0, 10));
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** "2027-06-01" -> "Jun 1, 2027". */
export function formatLongDate(dateOnly: string): string {
  const date = parseLocalDate(dateOnly.slice(0, 10));
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** 1234 cents -> "12.34", 1200 cents -> "12" — no trailing ".00" in an editable field. */
export function centsToInputText(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** "$1,234.5" -> 123450. Returns null for anything that isn't a non-negative amount. */
export function parseDollarsToCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
