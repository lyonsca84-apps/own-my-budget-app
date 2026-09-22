import { formatLocalDate, parseLocalDate } from './dates';
import type { CategorizedAmount } from './reports';

/**
 * Core budgeting math — pure, deterministic, framework-independent. Every
 * screen that shows a derived number (bill status, money left to spend,
 * planned vs. actual) must call one of these rather than computing it
 * inline, so the logic is tested once here instead of copied per screen.
 */

export type BillStatus = 'paid' | 'upcoming' | 'overdue';

/**
 * Bill status is never stored — it's derived from the due date and the sum
 * of payments logged against it, so it can't drift out of sync with reality.
 * A partial payment before the due date is still 'upcoming'; a partial
 * payment after the due date is still 'overdue' (the remainder is what's
 * overdue) — `remainingCents` tells the UI how much of it is left either way.
 */
export function deriveBillStatus(
  amountCents: number,
  paidCents: number,
  dueDate: string,
  today: Date
): { status: BillStatus; remainingCents: number } {
  const remainingCents = Math.max(amountCents - paidCents, 0);

  if (remainingCents === 0) {
    return { status: 'paid', remainingCents: 0 };
  }

  const dueAtEndOfDay = parseLocalDate(dueDate);
  dueAtEndOfDay.setHours(23, 59, 59, 999);
  const isPastDue = dueAtEndOfDay < today;
  return { status: isPastDue ? 'overdue' : 'upcoming', remainingCents };
}

export interface MoneyLeftToSpendInput {
  balanceCents: number;
  unpaidBillsCents: number;
}

export interface MoneyLeftToSpendLine {
  label: string;
  amountCents: number;
}

export interface MoneyLeftToSpendResult {
  totalCents: number;
  breakdown: MoneyLeftToSpendLine[];
}

/**
 * PLAN.md screen #12 ("Safe-to-Spend breakdown") shows this line by line —
 * `breakdown` is that line-item list, not just a display convenience.
 */
export function calculateMoneyLeftToSpend(input: MoneyLeftToSpendInput): MoneyLeftToSpendResult {
  return {
    totalCents: input.balanceCents - input.unpaidBillsCents,
    breakdown: [
      { label: 'Bank balance', amountCents: input.balanceCents },
      { label: 'Unpaid bills', amountCents: -input.unpaidBillsCents },
    ],
  };
}

export interface CategoryActualInput {
  categoryId: string;
  amountCents: number;
}

export interface CategoryPlannedInput {
  categoryId: string;
  label: string;
  plannedCents: number;
}

export interface CategoryPlanVsActual {
  categoryId: string;
  label: string;
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
}

/**
 * `transactions` are signed (negative = money out); only outflows count as
 * "actual spending" against a planned category amount.
 */
export function calculatePlannedVsActual(
  plannedByCategory: CategoryPlannedInput[],
  transactions: CategoryActualInput[]
): CategoryPlanVsActual[] {
  const actualByCategory = new Map<string, number>();
  for (const txn of transactions) {
    if (txn.amountCents >= 0) continue;
    const current = actualByCategory.get(txn.categoryId) ?? 0;
    actualByCategory.set(txn.categoryId, current + Math.abs(txn.amountCents));
  }

  return plannedByCategory.map((category) => {
    const actualCents = actualByCategory.get(category.categoryId) ?? 0;
    return {
      categoryId: category.categoryId,
      label: category.label,
      plannedCents: category.plannedCents,
      actualCents,
      remainingCents: category.plannedCents - actualCents,
    };
  });
}

export interface RolloverResult {
  categoryId: string;
  /** Positive = leftover carries forward as available; negative = overspend carries as a deficit. */
  rolloverCents: number;
}

/** PLAN.md screen #22: "Carries unpaid balances and leftover amounts into next month." */
export function calculateBudgetRollover(
  planVsActual: Pick<CategoryPlanVsActual, 'categoryId' | 'remainingCents'>[]
): RolloverResult[] {
  return planVsActual.map((c) => ({ categoryId: c.categoryId, rolloverCents: c.remainingCents }));
}

export interface PaycheckAllocation {
  categoryId: string;
  amountCents: number;
}

export interface PaycheckAssignmentResult {
  totalAllocatedCents: number;
  remainingCents: number;
  isOverAllocated: boolean;
}

/**
 * PLAN.md screen #17: splitting a paycheck across categories. This only
 * validates the arithmetic (allocations can never exceed the paycheck) —
 * it doesn't persist anything, that's the caller's job via packages/api.
 */
export function assignPaycheck(
  paycheckAmountCents: number,
  allocations: PaycheckAllocation[]
): PaycheckAssignmentResult {
  const totalAllocatedCents = allocations.reduce((sum, a) => sum + a.amountCents, 0);
  return {
    totalAllocatedCents,
    remainingCents: paycheckAmountCents - totalAllocatedCents,
    isOverAllocated: totalAllocatedCents > paycheckAmountCents,
  };
}

export interface SignedAmountInput {
  amountCents: number;
}

/** Sum of positive (income) amounts in a set of transactions/paychecks. */
export function calculateIncomeTotal(entries: SignedAmountInput[]): number {
  return entries.reduce((sum, e) => sum + Math.max(e.amountCents, 0), 0);
}

/** Sum of negative (outflow) amounts, returned as a positive total. */
export function calculateExpenseTotal(entries: SignedAmountInput[]): number {
  return entries.reduce((sum, e) => sum + Math.max(-e.amountCents, 0), 0);
}

// ---------------------------------------------------------------------------
// Budget view (planned vs. actual by category, and payday projection)
// ---------------------------------------------------------------------------

export type PayFrequency = 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly' | 'variable';

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Projects the next `count` paydays (YYYY-MM-DD, ascending) of a pay
 * schedule on or after `from`. `anchorDate` is the schedule's known pay date
 * (income_sources.next_pay_date) — it can be in the past, in which case the
 * schedule is rolled forward from it. Schedules with no anchor, and
 * 'variable' schedules (which only ever have their one stated date), can't be
 * projected further.
 */
export function generatePaydays(
  frequency: PayFrequency,
  anchorDate: string | null,
  count: number,
  from: Date
): string[] {
  if (!anchorDate || count <= 0) return [];
  const anchor = parseLocalDate(anchorDate);
  const floor = startOfDay(from);
  const result: string[] = [];

  if (frequency === 'variable') {
    return anchor >= floor ? [formatLocalDate(anchor)] : [];
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const stepDays = frequency === 'weekly' ? 7 : 14;
    const cursor = new Date(anchor);
    if (cursor < floor) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysBehind = Math.round((floor.getTime() - cursor.getTime()) / msPerDay);
      cursor.setDate(cursor.getDate() + Math.floor(daysBehind / stepDays) * stepDays);
      while (cursor < floor) cursor.setDate(cursor.getDate() + stepDays);
    }
    while (result.length < count) {
      result.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + stepDays);
    }
    return result;
  }

  const lower = anchor > floor ? anchor : floor;
  const anchorDay = anchor.getDate();
  const daysOfMonth =
    frequency === 'twice_monthly'
      ? [anchorDay, anchorDay <= 15 ? anchorDay + 15 : anchorDay - 15].sort((a, b) => a - b)
      : [anchorDay];

  let year = lower.getFullYear();
  let month = lower.getMonth();
  // Bounded loop: at most 2 paydays per month, so `count` paydays fit well inside this.
  for (let guard = 0; guard < count * 2 + 4 && result.length < count; guard++) {
    const length = daysInMonth(year, month);
    for (const day of daysOfMonth) {
      const candidate = new Date(year, month, Math.min(day, length));
      if (candidate >= lower && result.length < count) result.push(formatLocalDate(candidate));
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return result;
}

export type BudgetRowState = 'unplanned' | 'on-track' | 'near' | 'over';

export interface BudgetLineInput {
  categoryId: string;
  plannedCents: number;
  /** A user-typed replacement for the tracked amount; null = use the tracked amount. */
  actualOverrideCents: number | null;
}

export interface BudgetCategoryRow {
  categoryId: string;
  name: string;
  plannedCents: number;
  /** Sum of what was actually recorded (payments/transactions) for this category and month. */
  trackedCents: number;
  /** What the row shows: the override if the user set one, otherwise the tracked amount. */
  actualCents: number;
  isOverridden: boolean;
  /** Planned minus actual; negative when over. */
  remainingCents: number;
  overCents: number;
  /** Rounded whole percent of plan used; null when nothing is planned. */
  percentUsed: number | null;
  state: BudgetRowState;
}

/** From this share of the plan used a row reads as "near" — a heads-up, not a warning. */
export const BUDGET_NEAR_THRESHOLD_PERCENT = 85;

/**
 * Builds one planned-vs-actual row per category. `tracked` are positive
 * spend amounts already filtered to the month (bill payments, outflow
 * transactions); a categoryId that isn't in `categories` is ignored, since
 * it can't be shown as a row.
 */
export function buildBudgetRows(
  categories: { id: string; name: string }[],
  lines: BudgetLineInput[],
  tracked: CategorizedAmount[]
): BudgetCategoryRow[] {
  const lineByCategory = new Map(lines.map((l) => [l.categoryId, l]));
  const trackedByCategory = new Map<string, number>();
  for (const item of tracked) {
    if (!item.categoryId) continue;
    trackedByCategory.set(
      item.categoryId,
      (trackedByCategory.get(item.categoryId) ?? 0) + item.amountCents
    );
  }

  return categories.map((category) => {
    const line = lineByCategory.get(category.id);
    const plannedCents = line?.plannedCents ?? 0;
    const trackedCents = trackedByCategory.get(category.id) ?? 0;
    const isOverridden = line?.actualOverrideCents != null;
    const actualCents = isOverridden ? (line!.actualOverrideCents as number) : trackedCents;
    const remainingCents = plannedCents - actualCents;
    const percentUsed = plannedCents > 0 ? Math.round((actualCents / plannedCents) * 100) : null;

    let state: BudgetRowState;
    if (plannedCents <= 0) state = 'unplanned';
    else if (actualCents > plannedCents) state = 'over';
    else if ((percentUsed ?? 0) >= BUDGET_NEAR_THRESHOLD_PERCENT) state = 'near';
    else state = 'on-track';

    return {
      categoryId: category.id,
      name: category.name,
      plannedCents,
      trackedCents,
      actualCents,
      isOverridden,
      remainingCents,
      overCents: Math.max(-remainingCents, 0),
      percentUsed,
      state,
    };
  });
}

export interface BudgetSummary {
  plannedCents: number;
  actualCents: number;
  /** Planned minus actual across the whole period; negative when over. */
  remainingCents: number;
  overCategoryCount: number;
  /** Rounded whole percent of the total plan used; null when nothing is planned. */
  percentUsed: number | null;
}

export function summarizeBudget(rows: BudgetCategoryRow[]): BudgetSummary {
  const plannedCents = rows.reduce((sum, r) => sum + r.plannedCents, 0);
  const actualCents = rows.reduce((sum, r) => sum + r.actualCents, 0);
  return {
    plannedCents,
    actualCents,
    remainingCents: plannedCents - actualCents,
    overCategoryCount: rows.filter((r) => r.state === 'over').length,
    percentUsed: plannedCents > 0 ? Math.round((actualCents / plannedCents) * 100) : null,
  };
}

// ---------------------------------------------------------------------------
// Budget view helpers (bar layout, income-source labels)
// ---------------------------------------------------------------------------

export interface BudgetBarPercents {
  categoryId: string;
  /** 0-100: how much of the shared track the planned amount fills. */
  plannedPercent: number;
  /** 0-100: how much of the shared track the actual amount fills. */
  actualPercent: number;
}

/**
 * Bar widths for the planned-vs-actual list. Every row is scaled against the
 * largest planned OR actual figure so a planned bar and an actual bar can
 * never run past the end of the track, and rows compare with each other.
 */
export function budgetBarPercents(rows: BudgetCategoryRow[]): BudgetBarPercents[] {
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.plannedCents, r.actualCents)));
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  return rows.map((r) => ({
    categoryId: r.categoryId,
    plannedPercent: clamp((r.plannedCents / scale) * 100),
    actualPercent: clamp((r.actualCents / scale) * 100),
  }));
}

const INCOME_LABEL_SEPARATOR = ' · ';

/**
 * Income sources store one `label`; the design shows it as "Person · Source"
 * ("Jamie · Retail Job"). A label with no separator is all source.
 */
export function splitIncomeLabel(label: string): { person: string; source: string } {
  const index = label.indexOf(INCOME_LABEL_SEPARATOR);
  if (index === -1) return { person: '', source: label.trim() };
  return {
    person: label.slice(0, index).trim(),
    source: label.slice(index + INCOME_LABEL_SEPARATOR.length).trim(),
  };
}

/** Inverse of {@link splitIncomeLabel}; either half may be empty. */
export function joinIncomeLabel(person: string, source: string): string {
  const p = person.trim();
  const s = source.trim();
  return p && s ? `${p}${INCOME_LABEL_SEPARATOR}${s}` : p || s;
}
