/**
 * Budget Health Score — a single 0-100 number summarizing whether this
 * month's numbers look solid or need attention. It is an educational
 * estimate built entirely from the user's own numbers, never a credit score
 * and never financial advice — screens showing it must say so.
 *
 * Four weighted components, each already used elsewhere in the app so the
 * score never introduces a new hidden metric:
 *  - Cash cushion (35 pts): how much of the current balance is still free
 *    to spend after bills (`moneyLeftToSpendCents` / `balanceCents`).
 *  - Bills on track (25 pts): the share of tracked bills that are not
 *    currently overdue.
 *  - Debt load (20 pts): revolving-credit utilization when known, else a
 *    coarser debt-to-assets ratio; no debt at all scores full marks.
 *  - Savings progress (20 pts): average progress across active savings
 *    goals; having no goals yet is treated as neutral, not a penalty.
 */

export interface BudgetHealthInput {
  balanceCents: number;
  moneyLeftToSpendCents: number;
  overdueBillsCount: number;
  totalBillsCount: number;
  debtTotalCents: number;
  savingsTotalCents: number;
  /** Average credit-card utilization across revolving debts, 0-100+. `null` when there are no credit-card-type debts to measure. */
  averageCreditUtilizationPercent: number | null;
  /** Average progress across active savings goals, 0-100+. `null` when there are no goals yet. */
  averageSavingsGoalPercent: number | null;
}

export type BudgetHealthTone = 'danger' | 'watch' | 'positive';

export interface BudgetHealthResult {
  /** 0-100, rounded. */
  score: number;
  tone: BudgetHealthTone;
  label: string;
  summary: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function cashCushionPoints(balanceCents: number, moneyLeftToSpendCents: number): number {
  if (balanceCents <= 0) return 0;
  return clamp01(moneyLeftToSpendCents / balanceCents) * 35;
}

function billsOnTrackPoints(overdueBillsCount: number, totalBillsCount: number): number {
  if (totalBillsCount <= 0) return 25;
  return clamp01(1 - overdueBillsCount / totalBillsCount) * 25;
}

function debtLoadPoints(
  debtTotalCents: number,
  balanceCents: number,
  savingsTotalCents: number,
  averageCreditUtilizationPercent: number | null
): number {
  if (debtTotalCents <= 0) return 20;
  if (averageCreditUtilizationPercent !== null) {
    return clamp01(1 - averageCreditUtilizationPercent / 100) * 20;
  }
  const assets = Math.max(balanceCents + savingsTotalCents, 1);
  return clamp01(1 - debtTotalCents / assets) * 20;
}

function savingsProgressPoints(averageSavingsGoalPercent: number | null): number {
  if (averageSavingsGoalPercent === null) return 10; // neutral: no goal in motion yet, not a penalty
  return clamp01(averageSavingsGoalPercent / 100) * 20;
}

const BANDS: { min: number; tone: BudgetHealthTone; label: string; summary: string }[] = [
  {
    min: 70,
    tone: 'positive',
    label: 'On track',
    summary: 'Your budget is in great shape this month.',
  },
  {
    min: 40,
    tone: 'watch',
    label: 'Making progress',
    summary: "You're making progress — a couple of areas could use a closer look.",
  },
  {
    min: 0,
    tone: 'danger',
    label: 'Needs attention',
    summary: 'A few areas need attention this month.',
  },
];

export function calculateBudgetHealth(input: BudgetHealthInput): BudgetHealthResult {
  const rawScore =
    cashCushionPoints(input.balanceCents, input.moneyLeftToSpendCents) +
    billsOnTrackPoints(input.overdueBillsCount, input.totalBillsCount) +
    debtLoadPoints(
      input.debtTotalCents,
      input.balanceCents,
      input.savingsTotalCents,
      input.averageCreditUtilizationPercent
    ) +
    savingsProgressPoints(input.averageSavingsGoalPercent);

  const score = Math.round(clamp01(rawScore / 100) * 100);
  const band = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];

  return { score, tone: band.tone, label: band.label, summary: band.summary };
}
