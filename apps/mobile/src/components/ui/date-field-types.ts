export interface DateFieldProps {
  label: string;
  hideLabel?: boolean;
  /** `YYYY-MM-DD`, or '' when empty. */
  value: string;
  onChange: (value: string) => void;
  errorMessage?: string;
  disabled?: boolean;
  /** Earliest / latest selectable date (`YYYY-MM-DD`) — enforced by the web picker. */
  min?: string;
  max?: string;
}

/** True for a real calendar date written exactly as `YYYY-MM-DD` (rejects 2026-02-31). */
export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
