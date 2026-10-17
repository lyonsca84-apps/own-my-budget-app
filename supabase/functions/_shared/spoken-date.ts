// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/spokenDate.ts — see jev-decisions.ts for why.

export interface ParsedDate {
  isoDate: string;
  confidence: 'exact' | 'relative';
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_ABBREVIATIONS = MONTH_NAMES.map((m) => m.slice(0, 3));
const MONTH_NAME_PATTERN = [...MONTH_NAMES, ...MONTH_ABBREVIATIONS].join('|');

function formatLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, delta: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + delta);
  return result;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function resolveMonthName(name: string): number | null {
  const full = MONTH_NAMES.indexOf(name);
  if (full !== -1) return full;
  if (name.length === 3) {
    const abbr = MONTH_ABBREVIATIONS.indexOf(name);
    if (abbr !== -1) return abbr;
  }
  return null;
}

function normalizeYear(year: number): number {
  if (year >= 100) return year;
  return year + 2000;
}

export function parseSpokenDate(text: string, referenceDate: Date): ParsedDate | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'today')
    return { isoDate: formatLocal(referenceDate), confidence: 'relative' };
  if (normalized === 'yesterday') {
    return { isoDate: formatLocal(addDays(referenceDate, -1)), confidence: 'relative' };
  }
  if (normalized === 'tomorrow') {
    return { isoDate: formatLocal(addDays(referenceDate, 1)), confidence: 'relative' };
  }

  const daysAgoMatch = normalized.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    return {
      isoDate: formatLocal(addDays(referenceDate, -Number(daysAgoMatch[1]))),
      confidence: 'relative',
    };
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return isValidCalendarDate(Number(y), Number(m), Number(d))
      ? { isoDate: `${y}-${m}-${d}`, confidence: 'exact' }
      : null;
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = slashMatch[3] ? normalizeYear(Number(slashMatch[3])) : referenceDate.getFullYear();
    return isValidCalendarDate(year, month, day)
      ? {
          isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          confidence: 'exact',
        }
      : null;
  }

  const monthNameMatch = normalized.match(
    new RegExp(`^(${MONTH_NAME_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?$`)
  );
  if (monthNameMatch) {
    const monthIndex = resolveMonthName(monthNameMatch[1]);
    if (monthIndex === null) return null;
    const day = Number(monthNameMatch[2]);
    const year = monthNameMatch[3] ? Number(monthNameMatch[3]) : referenceDate.getFullYear();
    return isValidCalendarDate(year, monthIndex + 1, day)
      ? {
          isoDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          confidence: 'exact',
        }
      : null;
  }

  const dayOnlyMatch = normalized.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)$/);
  if (dayOnlyMatch) {
    const day = Number(dayOnlyMatch[1]);
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    return isValidCalendarDate(year, month, day)
      ? {
          isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          confidence: 'relative',
        }
      : null;
  }

  return null;
}
