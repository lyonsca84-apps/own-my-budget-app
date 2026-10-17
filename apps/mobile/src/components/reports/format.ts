const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "2026-08-06" -> "Aug 6". Returns an em dash for a missing date. */
export function formatShortDate(dateOnly: string | null | undefined): string {
  if (!dateOnly) return '—';
  const [, month, day] = dateOnly.split('-').map(Number);
  if (!month || !day) return dateOnly;
  return `${SHORT_MONTHS[month - 1]} ${day}`;
}

/** "2026-08" -> "Aug 2026". */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return `${SHORT_MONTHS[month - 1]} ${year}`;
}
