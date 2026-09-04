import { DEMO_DATA, sumUnpaidBills, sumDebtBalances, sumSavingsSaved } from '../demoData';

describe('DEMO_DATA', () => {
  it('matches PLAN.md §2: 8 bills, 2 credit cards, a car loan, a mortgage, 2 savings goals', () => {
    expect(DEMO_DATA.bills).toHaveLength(8);
    expect(DEMO_DATA.debts.filter((d) => d.type === 'creditCard')).toHaveLength(2);
    expect(DEMO_DATA.debts.filter((d) => d.type === 'autoLoan')).toHaveLength(1);
    expect(DEMO_DATA.debts.filter((d) => d.type === 'mortgage')).toHaveLength(1);
    expect(DEMO_DATA.savingsGoals).toHaveLength(2);
  });

  it('only ever stores money as integers (cents), never floats', () => {
    const allAmounts = [
      DEMO_DATA.account.balanceCents,
      ...DEMO_DATA.incomeSources.map((i) => i.amountCents),
      ...DEMO_DATA.bills.map((b) => b.amountCents),
      ...DEMO_DATA.debts.map((d) => d.balanceCents),
      ...DEMO_DATA.debts.map((d) => d.minimumPaymentCents),
      ...DEMO_DATA.savingsGoals.map((g) => g.targetCents),
      ...DEMO_DATA.savingsGoals.map((g) => g.savedCents),
      ...DEMO_DATA.transactions.map((t) => t.amountCents),
    ];
    for (const amount of allAmounts) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it('has no savings goal saved-so-far exceeding its target', () => {
    for (const goal of DEMO_DATA.savingsGoals) {
      expect(goal.savedCents).toBeLessThanOrEqual(goal.targetCents);
    }
  });
});

describe('demo data sums', () => {
  it('sumUnpaidBills excludes already-paid bills', () => {
    const total = sumUnpaidBills(DEMO_DATA);
    const expected = DEMO_DATA.bills
      .filter((b) => b.status !== 'paid')
      .reduce((sum, b) => sum + b.amountCents, 0);
    expect(total).toBe(expected);
    expect(total).toBeGreaterThan(0);
  });

  it('sumDebtBalances totals every debt', () => {
    expect(sumDebtBalances(DEMO_DATA)).toBe(
      DEMO_DATA.debts.reduce((sum, d) => sum + d.balanceCents, 0)
    );
  });

  it('sumSavingsSaved totals every goal', () => {
    expect(sumSavingsSaved(DEMO_DATA)).toBe(
      DEMO_DATA.savingsGoals.reduce((sum, g) => sum + g.savedCents, 0)
    );
  });
});
