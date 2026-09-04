import { parseLocalDate } from './dates';

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
