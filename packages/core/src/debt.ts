import { formatLocalDate } from './dates';

/**
 * Debt payoff math — pure, deterministic. Snowball and avalanche differ only
 * in the fixed priority order debts are attacked in; the accrual and
 * "snowballing" mechanic (a paid-off debt's minimum keeps flowing to the
 * next one) is identical either way.
 */

export type PayoffStrategy = 'snowball' | 'avalanche';

export interface DebtInput {
  id: string;
  balanceCents: number;
  aprBasisPoints: number;
  minimumPaymentCents: number;
}

export interface PayoffScheduleResult {
  strategy: PayoffStrategy;
  months: number;
  totalInterestCents: number;
  /** ISO date the last debt reaches a zero balance. */
  payoffDate: string;
  /** debtId -> the 1-indexed month its balance first reaches zero. */
  monthsToPayoffByDebt: Record<string, number>;
}

const MAX_MONTHS = 600; // 50 years — a hard stop so a payment that can't even cover interest can't loop forever.

function monthlyInterestCents(balanceCents: number, aprBasisPoints: number): number {
  return Math.round((balanceCents * aprBasisPoints) / 10_000 / 12);
}

function orderForStrategy(debts: DebtInput[], strategy: PayoffStrategy): DebtInput[] {
  const sorted = [...debts];
  if (strategy === 'snowball') {
    sorted.sort((a, b) => a.balanceCents - b.balanceCents);
  } else {
    sorted.sort((a, b) => b.aprBasisPoints - a.aprBasisPoints);
  }
  return sorted;
}

function addMonths(date: Date, months: number): string {
  const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  return formatLocalDate(result);
}

/**
 * PLAN.md screen #34: side-by-side snowball vs. avalanche. Call this once
 * per strategy and compare the results — it doesn't compare them itself.
 */
export function calculatePayoffSchedule(
  debts: DebtInput[],
  extraMonthlyCents: number,
  strategy: PayoffStrategy,
  startDate: Date = new Date()
): PayoffScheduleResult {
  const order = orderForStrategy(debts, strategy);
  const remaining = new Map(order.map((d) => [d.id, d.balanceCents]));
  const monthsToPayoffByDebt: Record<string, number> = {};
  // The total monthly budget is fixed: every debt's original minimum, plus
  // the extra — this stays constant because a paid-off debt's minimum
  // "snowballs" into the next target rather than shrinking the budget.
  const fixedMonthlyBudget =
    debts.reduce((sum, d) => sum + d.minimumPaymentCents, 0) + extraMonthlyCents;

  let totalInterestCents = 0;
  let month = 0;

  while (month < MAX_MONTHS && [...remaining.values()].some((balance) => balance > 0)) {
    month++;

    for (const debt of order) {
      const balance = remaining.get(debt.id)!;
      if (balance <= 0) continue;
      const interest = monthlyInterestCents(balance, debt.aprBasisPoints);
      totalInterestCents += interest;
      remaining.set(debt.id, balance + interest);
    }

    let budgetLeft = fixedMonthlyBudget;
    for (const debt of order) {
      const balance = remaining.get(debt.id)!;
      if (balance <= 0) continue;
      const payment = Math.min(debt.minimumPaymentCents, balance);
      remaining.set(debt.id, balance - payment);
      budgetLeft -= payment;
    }

    for (const debt of order) {
      if (budgetLeft <= 0) break;
      const balance = remaining.get(debt.id)!;
      if (balance <= 0) continue;
      const extraPayment = Math.min(budgetLeft, balance);
      remaining.set(debt.id, balance - extraPayment);
      budgetLeft -= extraPayment;
    }

    for (const debt of order) {
      if (monthsToPayoffByDebt[debt.id] === undefined && remaining.get(debt.id)! <= 0) {
        monthsToPayoffByDebt[debt.id] = month;
      }
    }
  }

  return {
    strategy,
    months: month,
    totalInterestCents,
    payoffDate: addMonths(startDate, month),
    monthsToPayoffByDebt,
  };
}

/** A simple percentage (0-100), not a display string — round for display where it's shown. */
export function calculateCreditUtilization(balanceCents: number, creditLimitCents: number): number {
  if (creditLimitCents <= 0) return 0;
  return (balanceCents / creditLimitCents) * 100;
}
