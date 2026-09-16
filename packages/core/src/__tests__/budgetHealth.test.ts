import { calculateBudgetHealth, type BudgetHealthInput } from '../budgetHealth';

const BASE: BudgetHealthInput = {
  balanceCents: 100_00,
  moneyLeftToSpendCents: 100_00,
  overdueBillsCount: 0,
  totalBillsCount: 0,
  debtTotalCents: 0,
  savingsTotalCents: 0,
  averageCreditUtilizationPercent: null,
  averageSavingsGoalPercent: null,
};

describe('calculateBudgetHealth', () => {
  it('scores a perfect cushion, no bills, no debt, and no goals as a high but not-quite-perfect score', () => {
    // Savings-progress is neutral (10/20) with no goals set, so a debt-free,
    // fully-cushioned account still tops out at 90, not 100.
    const result = calculateBudgetHealth(BASE);
    expect(result.score).toBe(90);
    expect(result.tone).toBe('positive');
    expect(result.label).toBe('On track');
  });

  it('scores a fully funded savings goal on top of a perfect cushion as 100', () => {
    const result = calculateBudgetHealth({ ...BASE, averageSavingsGoalPercent: 100 });
    expect(result.score).toBe(100);
    expect(result.tone).toBe('positive');
  });

  it('treats a zero or negative balance as no cushion at all', () => {
    const result = calculateBudgetHealth({
      ...BASE,
      balanceCents: 0,
      moneyLeftToSpendCents: 0,
    });
    expect(result.score).toBeLessThan(90);
  });

  it('drives the score down as more tracked bills are overdue', () => {
    const oneOverdue = calculateBudgetHealth({ ...BASE, overdueBillsCount: 1, totalBillsCount: 4 });
    const allOverdue = calculateBudgetHealth({ ...BASE, overdueBillsCount: 4, totalBillsCount: 4 });
    expect(oneOverdue.score).toBeGreaterThan(allOverdue.score);
  });

  it('rewards lower credit utilization over higher utilization at the same debt total', () => {
    const lowUtilization = calculateBudgetHealth({
      ...BASE,
      debtTotalCents: 500_00,
      averageCreditUtilizationPercent: 10,
    });
    const highUtilization = calculateBudgetHealth({
      ...BASE,
      debtTotalCents: 500_00,
      averageCreditUtilizationPercent: 90,
    });
    expect(lowUtilization.score).toBeGreaterThan(highUtilization.score);
  });

  it('falls back to a debt-to-assets ratio when utilization is unknown (e.g. only loans, no credit cards)', () => {
    const heavyDebtNoAssets = calculateBudgetHealth({
      ...BASE,
      balanceCents: 100_00,
      savingsTotalCents: 0,
      debtTotalCents: 10_000_00,
      averageCreditUtilizationPercent: null,
    });
    expect(heavyDebtNoAssets.score).toBeLessThan(BASE_SCORE());
  });

  it('treats having no savings goal as neutral rather than a penalty', () => {
    const noGoal = calculateBudgetHealth({ ...BASE, averageSavingsGoalPercent: null });
    const halfwayGoal = calculateBudgetHealth({ ...BASE, averageSavingsGoalPercent: 50 });
    const noGoalScore = noGoal.score;
    const halfwayGoalScore = halfwayGoal.score;
    // Neutral (10/20) sits below halfway progress (10/20 too, since 50% of 20 = 10) —
    // so they should be equal, and both below a fully complete goal.
    expect(noGoalScore).toBe(halfwayGoalScore);
    const complete = calculateBudgetHealth({ ...BASE, averageSavingsGoalPercent: 100 });
    expect(complete.score).toBeGreaterThan(noGoalScore);
  });

  it('never returns a score outside 0-100', () => {
    const worst = calculateBudgetHealth({
      balanceCents: -500_00,
      moneyLeftToSpendCents: -1000_00,
      overdueBillsCount: 10,
      totalBillsCount: 10,
      debtTotalCents: 50_000_00,
      savingsTotalCents: 0,
      averageCreditUtilizationPercent: 300,
      averageSavingsGoalPercent: 0,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
    expect(worst.tone).toBe('danger');
    expect(worst.label).toBe('Needs attention');
  });

  it('bands scores into danger (<40), watch (40-69), and positive (70+)', () => {
    expect(
      calculateBudgetHealth({ ...BASE, balanceCents: 0, moneyLeftToSpendCents: 0 }).tone
    ).not.toBe('positive');
    const midRange = calculateBudgetHealth({
      ...BASE,
      overdueBillsCount: 2,
      totalBillsCount: 4,
      debtTotalCents: 200_00,
      averageCreditUtilizationPercent: 50,
    });
    expect(['danger', 'watch']).toContain(midRange.tone);
  });
});

function BASE_SCORE(): number {
  return calculateBudgetHealth(BASE).score;
}
