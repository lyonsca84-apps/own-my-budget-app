import { DEMO_DATA, sumUnpaidBills, sumDebtBalances, sumSavingsSaved } from '../demoData';

import { buildDemoData } from '../demoData';
import { formatLocalDate } from '../dates';

describe('DEMO_DATA', () => {
  it('matches the approved design: 4 pay schedules, 6 bills, 11 cards, 6 loans, 4 goals', () => {
    expect(DEMO_DATA.incomeSources).toHaveLength(4);
    expect(DEMO_DATA.bills).toHaveLength(6);
    expect(DEMO_DATA.debts.filter((d) => d.type === 'creditCard')).toHaveLength(11);
    expect(DEMO_DATA.debts.filter((d) => d.type !== 'creditCard')).toHaveLength(6);
    expect(DEMO_DATA.savingsGoals).toHaveLength(4);
  });

  it("reproduces the design's headline figures", () => {
    const cards = DEMO_DATA.debts.filter((d) => d.type === 'creditCard');
    expect(Math.round(cards.reduce((s, d) => s + d.balanceCents, 0) / 100)).toBe(34_197);
    expect(Math.round(cards.reduce((s, d) => s + d.minimumPaymentCents, 0) / 100)).toBe(779);
    const loans = DEMO_DATA.debts.filter((d) => d.type !== 'creditCard');
    expect(loans.reduce((s, d) => s + d.balanceCents, 0) / 100).toBe(404_600);
    expect(loans.reduce((s, d) => s + d.minimumPaymentCents, 0) / 100).toBe(3_700);
    expect(sumSavingsSaved(DEMO_DATA) / 100).toBe(5_315);
  });

  it('keeps bill states right relative to whatever "today" is', () => {
    const today = new Date(2027, 0, 15);
    const data = buildDemoData(today);
    const by = Object.fromEntries(data.bills.map((b) => [b.label, b]));
    expect(by.Phone.status).toBe('overdue');
    expect(by.Phone.dueDate < formatLocalDate(today)).toBe(true);
    expect(by.Electric.dueDate > formatLocalDate(today)).toBe(true);
    expect(by.Rent.dueDate).toBe('2027-01-01');
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
