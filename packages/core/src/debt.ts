import { formatLocalDate, parseLocalDate } from './dates';

// Payment planning against upcoming paydays lives beside the debt math it
// feeds; re-exported here so the package root exports it through './debt'.
export * from './paymentPlan';

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
  /**
   * False when the schedule hit the hard month cap with balances remaining —
   * i.e. the monthly budget never outruns interest. `months`/`payoffDate`
   * are meaningless then, so callers should show "increase your payment".
   */
  completed: boolean;
}

const MAX_MONTHS = 600; // 50 years — a hard stop so a payment that can't even cover interest can't loop forever.

export function estimateMonthlyInterestCents(balanceCents: number, aprBasisPoints: number): number {
  return Math.round((balanceCents * aprBasisPoints) / 10_000 / 12);
}

/** The order a strategy attacks debts in: snowball = smallest balance first, avalanche = highest APR first. */
export function orderDebtsForStrategy(debts: DebtInput[], strategy: PayoffStrategy): DebtInput[] {
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
  const order = orderDebtsForStrategy(debts, strategy);
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
      const interest = estimateMonthlyInterestCents(balance, debt.aprBasisPoints);
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
    completed: [...remaining.values()].every((balance) => balance <= 0),
  };
}

/** A simple percentage (0-100), not a display string — round for display where it's shown. */
export function calculateCreditUtilization(balanceCents: number, creditLimitCents: number): number {
  if (creditLimitCents <= 0) return 0;
  return (balanceCents / creditLimitCents) * 100;
}

/**
 * Months to clear one balance with a fixed monthly payment, or `null` when
 * the payment never outruns the interest (or is zero) — display "increase
 * your payment" then, never a made-up date. 0 for an already-clear balance.
 */
export function monthsToPayOff(
  balanceCents: number,
  aprBasisPoints: number,
  monthlyPaymentCents: number
): number | null {
  if (balanceCents <= 0) return 0;
  if (monthlyPaymentCents <= 0) return null;
  const result = calculatePayoffSchedule(
    [
      {
        id: 'single',
        balanceCents,
        aprBasisPoints,
        minimumPaymentCents: monthlyPaymentCents,
      },
    ],
    0,
    'snowball'
  );
  return result.completed ? result.months : null;
}

export interface PayoffComparison {
  minimumOnly: PayoffScheduleResult;
  withExtra: PayoffScheduleResult;
  /** null unless both scenarios actually finish. */
  monthsSaved: number | null;
  interestSavedCents: number | null;
}

/** "Minimum payments only" vs "with extra each month" for the Payoff calculator. */
export function calculatePayoffComparison(
  debts: DebtInput[],
  extraMonthlyCents: number,
  strategy: PayoffStrategy,
  startDate: Date = new Date()
): PayoffComparison {
  const minimumOnly = calculatePayoffSchedule(debts, 0, strategy, startDate);
  const withExtra = calculatePayoffSchedule(debts, extraMonthlyCents, strategy, startDate);
  const bothFinish = minimumOnly.completed && withExtra.completed;
  return {
    minimumOnly,
    withExtra,
    monthsSaved: bothFinish ? Math.max(0, minimumOnly.months - withExtra.months) : null,
    interestSavedCents: bothFinish
      ? Math.max(0, minimumOnly.totalInterestCents - withExtra.totalInterestCents)
      : null,
  };
}

/** Percent (0-100) of a debt cleared since it started; null when there's no starting balance to measure against. */
export function calculateDebtPaidPercent(
  startingBalanceCents: number | null,
  currentBalanceCents: number
): number | null {
  if (startingBalanceCents === null || startingBalanceCents <= 0) return null;
  const paid = startingBalanceCents - currentBalanceCents;
  return Math.min(100, Math.max(0, Math.round((paid / startingBalanceCents) * 100)));
}

/**
 * Progress toward a "get card debt down to X" goal, 0-100. Zero until the
 * target sits below where the cards started (nothing to measure yet).
 */
export function calculatePayoffGoalPercent(
  startingDebtCents: number,
  currentDebtCents: number,
  targetDebtCents: number
): number {
  if (startingDebtCents <= targetDebtCents) return 0;
  const done = (startingDebtCents - currentDebtCents) / (startingDebtCents - targetDebtCents);
  return Math.min(100, Math.max(0, Math.round(done * 100)));
}

/**
 * The monthly payment that clears a promo balance by its expiry date
 * (balance spread evenly over the months left, rounded up). Null with no
 * promo balance or no expiry to aim for; the full balance once expired/this month.
 */
export function suggestedPromoPaymentCents(
  promoBalanceCents: number | null,
  promoExpiresOn: string | null,
  today: Date = new Date()
): number | null {
  if (promoBalanceCents === null || promoBalanceCents <= 0 || !promoExpiresOn) return null;
  const expiry = parseLocalDate(promoExpiresOn);
  const monthsLeft =
    (expiry.getFullYear() - today.getFullYear()) * 12 +
    (expiry.getMonth() - today.getMonth()) +
    (expiry.getDate() >= today.getDate() ? 1 : 0);
  return Math.ceil(promoBalanceCents / Math.max(1, monthsLeft));
}

/**
 * Splits money paid into an estimated interest / principal share by replaying
 * payments oldest-first at the debt's APR. Estimate only: the ledger
 * (`record_debt_payment`) reduces the balance by the full amount and doesn't
 * store the split, so surfaces must label these "est.".
 */
export function estimateInterestPaid(
  startingBalanceCents: number,
  aprBasisPoints: number,
  paymentsOldestFirst: { amountCents: number }[]
): { interestCents: number; principalCents: number } {
  let balance = startingBalanceCents;
  let interestCents = 0;
  let principalCents = 0;
  for (const { amountCents } of paymentsOldestFirst) {
    const interest = Math.min(amountCents, estimateMonthlyInterestCents(balance, aprBasisPoints));
    interestCents += interest;
    principalCents += amountCents - interest;
    balance = Math.max(0, balance - amountCents);
  }
  return { interestCents, principalCents };
}
