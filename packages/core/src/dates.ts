/**
 * Formats a Date as YYYY-MM-DD using its *local* calendar date.
 *
 * `date.toISOString().slice(0, 10)` is a common trap: toISOString() first
 * converts to UTC, so a date constructed at local midnight (e.g.
 * `new Date(2026, 8, 1)`) silently shifts to the previous day for any
 * timezone behind UTC — which is all of the US, this app's launch region.
 * Always use this instead when the date came from local calendar math.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a "YYYY-MM-DD" string (e.g. a bill's due_date, a paycheck's
 * pay_date — every date-only column in the schema) into a Date representing
 * that calendar day at *local* midnight.
 *
 * `new Date('2026-09-09')` is the trap this avoids: a bare date-only string
 * is parsed as UTC midnight per the ECMAScript spec, while
 * `new Date(y, m, d)` is parsed as *local* midnight. Mixing the two silently
 * shifts the date by a day in any non-UTC timezone. Always parse a
 * date-only string from the database with this, never with `new Date(str)`.
 */
export function parseLocalDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}
