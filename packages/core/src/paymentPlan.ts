import { formatLocalDate, parseLocalDate } from './dates';

/**
 * "Plan payment" support: projects upcoming paydays from income schedules so a
 * bill or debt payment can be split across them before any paycheck has been
 * logged. Pure and deterministic — the caller passes `from`.
 */

export interface PaydaySchedule {
  /** income_sources.id */
  id: string;
  label: string;
  amountCents: number;
  /** income_sources.frequency: weekly | biweekly | twice_monthly | monthly | variable */
  frequency: string;
  /** YYYY-MM-DD of the next (or a past) pay date; null when the schedule has none set. */
  nextPayDate: string | null;
}

export interface Payday {
  /** Stable "<sourceId>|<date>" identifier. */
  key: string;
  incomeSourceId: string;
  /** YYYY-MM-DD */
  date: string;
  label: string;
  amountCents: number;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Same day next month, clamped to that month's last day (Jan 31 -> Feb 28). */
function addOneMonth(date: Date): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Twice-monthly: the 1st-15th pay date pairs with the day 15 later, and vice versa. */
function nextTwiceMonthly(date: Date): Date {
  if (date.getDate() <= 15) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return new Date(date.getFullYear(), date.getMonth(), Math.min(date.getDate() + 15, lastDay));
  }
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.max(1, date.getDate() - 15));
}

function advance(date: Date, frequency: string): Date | null {
  switch (frequency) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'twice_monthly':
      return nextTwiceMonthly(date);
    case 'monthly':
      return addOneMonth(date);
    default:
      return null; // 'variable' has no predictable cadence
  }
}

/** The next `count` paydays across every schedule, soonest first, starting today. */
export function upcomingPaydays(
  schedules: PaydaySchedule[],
  count: number,
  from: Date = new Date()
): Payday[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const result: Payday[] = [];

  for (const schedule of schedules) {
    if (!schedule.nextPayDate) continue;
    let date: Date | null = parseLocalDate(schedule.nextPayDate);
    let guard = 0;
    while (date && date < today && guard++ < 500) date = advance(date, schedule.frequency);
    let taken = 0;
    while (date && taken < count && guard++ < 1000) {
      const iso = formatLocalDate(date);
      result.push({
        key: `${schedule.id}|${iso}`,
        incomeSourceId: schedule.id,
        date: iso,
        label: schedule.label,
        amountCents: schedule.amountCents,
      });
      taken++;
      date = advance(date, schedule.frequency);
    }
  }

  return result
    .sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date < b.date ? -1 : 1))
    .slice(0, count);
}

export interface PlanPortionInput {
  amountCents: number;
}

export type PlanCoverage =
  | { kind: 'unplanned' }
  | { kind: 'partial'; remainingCents: number }
  | { kind: 'full' }
  | { kind: 'over'; overCents: number };

/** How much of `totalCents` the planned portions cover — drives the "still unassigned" / "over" line. */
export function summarizePlanCoverage(
  totalCents: number,
  portions: PlanPortionInput[]
): PlanCoverage {
  const planned = portions.reduce((sum, p) => sum + p.amountCents, 0);
  if (planned === 0) return { kind: 'unplanned' };
  if (planned === totalCents) return { kind: 'full' };
  if (planned < totalCents) return { kind: 'partial', remainingCents: totalCents - planned };
  return { kind: 'over', overCents: planned - totalCents };
}
