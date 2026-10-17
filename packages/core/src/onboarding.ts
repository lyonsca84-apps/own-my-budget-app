import { countPaydaysInMonth } from './dashboard';
import { formatLocalDate, parseLocalDate } from './dates';
import { formatCents } from './money';

/**
 * First-run onboarding — the pure rules behind the interview: validating
 * what the user typed, explaining how a monthly income figure is reached,
 * and turning the answers into the rows that get saved.
 *
 * Safety rules carried through every helper:
 * - A skipped answer stays unknown. Nothing here invents a zero, an average
 *   or a default amount.
 * - Monthly income is never converted silently. Fixed schedules use the same
 *   `countPaydaysInMonth` rule the Dashboard uses; irregular income is only
 *   ever a monthly estimate the user typed themselves.
 * - Only take-home pay is asked for — there is no gross-to-net conversion.
 */

export type OnboardingPayFrequency =
  | 'weekly'
  | 'biweekly'
  | 'twice_monthly'
  | 'monthly'
  | 'irregular';

export const ONBOARDING_PAY_FREQUENCIES: OnboardingPayFrequency[] = [
  'weekly',
  'biweekly',
  'twice_monthly',
  'monthly',
  'irregular',
];

export interface OnboardingIncomeDraft {
  /** Optional name for the income ("Riverside Retail"). */
  label: string;
  frequency: OnboardingPayFrequency | null;
  /** Take-home pay per paycheck — or, for irregular income, a monthly estimate. */
  amountText: string;
  /** `YYYY-MM-DD`, or '' when unknown. Not asked for irregular income. */
  nextPayDate: string;
}

export function emptyIncomeDraft(): OnboardingIncomeDraft {
  return { label: '', frequency: null, amountText: '', nextPayDate: '' };
}

/** Largest amount accepted, to catch typos like a few extra zeros. */
export const ONBOARDING_MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000

export const ONBOARDING_NAME_MAX_LENGTH = 40;

/** Weekly and every-two-weeks pay can't be counted per month without a known payday. */
export function needsPayDateForMonthlyTotal(frequency: OnboardingPayFrequency | null): boolean {
  return frequency === 'weekly' || frequency === 'biweekly';
}

/** "$1,234.50" → 123450. `null` when blank, `'invalid'` when it isn't a usable amount. */
export function parseOnboardingAmount(text: string): number | null | 'invalid' {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return 'invalid';
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents > ONBOARDING_MAX_AMOUNT_CENTS) return 'invalid';
  return cents;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatLocalDate(parseLocalDate(value)) === value;
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export interface IncomeDraftErrors {
  frequency?: string;
  amount?: string;
  nextPayDate?: string;
}

/** Gentle, field-level messages. An empty object means the draft can be saved. */
export function validateIncomeDraft(draft: OnboardingIncomeDraft, today: Date): IncomeDraftErrors {
  const errors: IncomeDraftErrors = {};
  if (!draft.frequency) errors.frequency = 'Choose how often you get paid.';

  const cents = parseOnboardingAmount(draft.amountText);
  const isEstimate = draft.frequency === 'irregular';
  if (cents === null) {
    errors.amount = isEstimate
      ? 'Enter your best monthly estimate, or choose “I’ll add income later.”'
      : 'Enter the amount you take home from each paycheck.';
  } else if (cents === 'invalid' || cents <= 0) {
    errors.amount = 'Enter an amount like 850 or 850.25.';
  }

  if (draft.frequency && !isEstimate) {
    const date = draft.nextPayDate.trim();
    if (!date) {
      if (needsPayDateForMonthlyTotal(draft.frequency)) {
        errors.nextPayDate = 'Add your next payday so we can count your paydays each month.';
      }
    } else if (!isIsoDate(date)) {
      errors.nextPayDate = 'Pick a real date.';
    } else {
      const offset = daysBetween(today, parseLocalDate(date));
      if (offset < -31) errors.nextPayDate = 'Pick your next payday, a date coming up soon.';
      else if (offset > 366) errors.nextPayDate = 'Pick a payday within the next year.';
    }
  }
  return errors;
}

export function hasIncomeDraftErrors(errors: IncomeDraftErrors): boolean {
  return Boolean(errors.frequency || errors.amount || errors.nextPayDate);
}

export type MonthlyIncomeExplanation =
  | {
      kind: 'calculated';
      perPaycheckCents: number;
      paydays: number;
      monthlyCents: number;
      /** Plain-language sentence showing the math. */
      text: string;
    }
  | { kind: 'estimate'; monthlyCents: number; text: string }
  | { kind: 'unknown'; text: string };

const MONTH_NAMES = [
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

/**
 * How a draft becomes a month's income on the Dashboard, in words. Uses the
 * Dashboard's own payday-counting rule, so the number shown here is the
 * number the Dashboard shows for the same month.
 */
export function explainMonthlyIncome(
  draft: OnboardingIncomeDraft,
  year: number,
  month: number
): MonthlyIncomeExplanation {
  const cents = parseOnboardingAmount(draft.amountText);
  if (!draft.frequency || cents === null || cents === 'invalid' || cents <= 0) {
    return { kind: 'unknown', text: 'Not added yet.' };
  }
  if (draft.frequency === 'irregular') {
    return {
      kind: 'estimate',
      monthlyCents: cents,
      text: `We count about ${formatCents(cents)} each month, just as you entered it.`,
    };
  }
  const date = draft.nextPayDate.trim() || null;
  if (needsPayDateForMonthlyTotal(draft.frequency) && !date) {
    return { kind: 'unknown', text: 'Add your next payday to see a monthly total.' };
  }
  const paydays = countPaydaysInMonth(draft.frequency, date, year, month);
  const monthlyCents = paydays * cents;
  const paydayWord = paydays === 1 ? 'payday' : 'paydays';
  const note = needsPayDateForMonthlyTotal(draft.frequency)
    ? ' Some months have an extra payday, so this can change from month to month.'
    : '';
  return {
    kind: 'calculated',
    perPaycheckCents: cents,
    paydays,
    monthlyCents,
    text: `${paydays} ${paydayWord} in ${MONTH_NAMES[month]} × ${formatCents(cents)} = ${formatCents(
      monthlyCents
    )}.${note}`,
  };
}

export interface OnboardingAnswers {
  /** What the user typed for their name ('' = skipped). */
  displayName: string;
  /** The name already on the profile, so an unchanged or skipped name isn't rewritten. */
  existingDisplayName: string;
  /** Empty when income was skipped. Each entry should already pass `validateIncomeDraft`. */
  incomes: OnboardingIncomeDraft[];
}

export interface OnboardingIncomeRow {
  label: string;
  amount_cents: number;
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  next_pay_date: string | null;
  is_variable: boolean;
}

export interface OnboardingSavePlan {
  /** `null` = leave the profile name alone. */
  displayName: string | null;
  incomeRows: OnboardingIncomeRow[];
}

/**
 * Turns reviewed answers into exactly what gets written — and nothing for
 * anything skipped. Irregular income is stored as a monthly figure flagged
 * `is_variable`, with no invented payday.
 */
export function buildOnboardingSavePlan(answers: OnboardingAnswers): OnboardingSavePlan {
  const name = answers.displayName.trim().slice(0, ONBOARDING_NAME_MAX_LENGTH);
  const displayName = name && name !== answers.existingDisplayName.trim() ? name : null;

  const usedLabels = new Set<string>();
  const incomeRows: OnboardingIncomeRow[] = [];
  for (const draft of answers.incomes) {
    const cents = parseOnboardingAmount(draft.amountText);
    const frequency = draft.frequency;
    if (!frequency || typeof cents !== 'number' || cents <= 0) continue;
    const isEstimate = frequency === 'irregular';
    const base = draft.label.trim() || (isEstimate ? 'Estimated income' : 'Take-home pay');
    let label = base;
    for (let n = 2; usedLabels.has(label); n++) label = `${base} ${n}`;
    usedLabels.add(label);
    incomeRows.push({
      label,
      amount_cents: cents,
      frequency: frequency === 'irregular' ? 'monthly' : frequency,
      next_pay_date: isEstimate ? null : draft.nextPayDate.trim() || null,
      is_variable: isEstimate,
    });
  }
  return { displayName, incomeRows };
}
