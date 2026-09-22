/**
 * Local-time date helpers. The app treats `YYYY-MM-DD` strings as *local*
 * calendar dates (see packages/core's formatLocalDate), so the seed does too.
 * Duplicated here on purpose: this package has no dependency on core.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** `YYYY-MM-DD` for `days` from `now` (negative = the past). */
export function dateAt(now: Date, days: number): string {
  return formatDate(addDays(now, days));
}

/** First day of the month `monthOffset` months from `now`'s month. */
export function monthStart(now: Date, monthOffset = 0): Date {
  return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
}

/** Last day of the month `monthOffset` months from `now`'s month. */
export function monthEnd(now: Date, monthOffset = 0): Date {
  return new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
}

/** An ISO timestamp for local wall-clock `hour:minute` on the day `days` from `now`. */
export function timestampAt(now: Date, days: number, hour = 9, minute = 0, second = 0): string {
  const base = addDays(now, days);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hour,
    minute,
    second
  ).toISOString();
}
