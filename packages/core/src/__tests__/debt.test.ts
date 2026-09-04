import { calculatePayoffSchedule, calculateCreditUtilization, type DebtInput } from '../debt';

describe('calculatePayoffSchedule', () => {
  it('pays off a single zero-interest debt in balance/minPayment months', () => {
    const debts: DebtInput[] = [
      { id: 'a', balanceCents: 1_000, aprBasisPoints: 0, minimumPaymentCents: 100 },
    ];
    const result = calculatePayoffSchedule(debts, 0, 'snowball');
    expect(result.months).toBe(10);
    expect(result.totalInterestCents).toBe(0);
    expect(result.monthsToPayoffByDebt).toEqual({ a: 10 });
  });

  it('finishes sooner when extra payment is added', () => {
    const debts: DebtInput[] = [
      { id: 'a', balanceCents: 1_000, aprBasisPoints: 0, minimumPaymentCents: 100 },
    ];
    const result = calculatePayoffSchedule(debts, 100, 'snowball');
    expect(result.months).toBe(5);
  });

  it("snowballs a paid-off debt's minimum into the next target, in balance order", () => {
    const debts: DebtInput[] = [
      { id: 'a', balanceCents: 500, aprBasisPoints: 0, minimumPaymentCents: 50 },
      { id: 'b', balanceCents: 2_000, aprBasisPoints: 0, minimumPaymentCents: 100 },
    ];
    const result = calculatePayoffSchedule(debts, 0, 'snowball');
    // Hand-verified: A alone takes 10 months; from month 11, A's freed $50
    // joins B's $100 minimum ($150/mo) against B's remaining $1,000 balance,
    // finishing at month 17.
    expect(result.monthsToPayoffByDebt).toEqual({ a: 10, b: 17 });
    expect(result.months).toBe(17);
    expect(result.totalInterestCents).toBe(0);
  });

  it('accrues nonzero interest for a debt with a real APR', () => {
    const debts: DebtInput[] = [
      { id: 'a', balanceCents: 100_000, aprBasisPoints: 1_800, minimumPaymentCents: 5_000 },
    ];
    const result = calculatePayoffSchedule(debts, 0, 'snowball');
    expect(result.totalInterestCents).toBeGreaterThan(0);
    expect(result.monthsToPayoffByDebt.a).toBe(result.months);
  });

  it('avalanche never accrues more total interest than snowball on the same debts', () => {
    const debts: DebtInput[] = [
      { id: 'low-apr', balanceCents: 500_000, aprBasisPoints: 500, minimumPaymentCents: 10_000 },
      { id: 'high-apr', balanceCents: 500_000, aprBasisPoints: 2_400, minimumPaymentCents: 10_000 },
    ];
    const snowball = calculatePayoffSchedule(debts, 20_000, 'snowball');
    const avalanche = calculatePayoffSchedule(debts, 20_000, 'avalanche');
    expect(avalanche.totalInterestCents).toBeLessThanOrEqual(snowball.totalInterestCents);
  });

  it('avalanche prioritizes the higher-APR debt for extra payments', () => {
    const debts: DebtInput[] = [
      { id: 'low-apr', balanceCents: 100_000, aprBasisPoints: 500, minimumPaymentCents: 2_000 },
      { id: 'high-apr', balanceCents: 100_000, aprBasisPoints: 2_500, minimumPaymentCents: 2_000 },
    ];
    const result = calculatePayoffSchedule(debts, 10_000, 'avalanche');
    expect(result.monthsToPayoffByDebt['high-apr']).toBeLessThan(
      result.monthsToPayoffByDebt['low-apr']
    );
  });

  it('produces a payoff date that many months after the start date', () => {
    const debts: DebtInput[] = [
      { id: 'a', balanceCents: 300, aprBasisPoints: 0, minimumPaymentCents: 100 },
    ];
    // Constructed via (y, m, d), not a bare date string — the latter parses
    // as UTC midnight and can shift a day off in non-UTC timezones.
    const result = calculatePayoffSchedule(debts, 0, 'snowball', new Date(2026, 0, 15));
    expect(result.months).toBe(3);
    expect(result.payoffDate).toBe('2026-04-15');
  });
});

describe('calculateCreditUtilization', () => {
  it('computes a percentage of the limit used', () => {
    expect(calculateCreditUtilization(500_00, 1_000_00)).toBe(50);
  });

  it('is zero for a zero balance', () => {
    expect(calculateCreditUtilization(0, 1_000_00)).toBe(0);
  });

  it('returns zero rather than dividing by zero for a zero limit', () => {
    expect(calculateCreditUtilization(500_00, 0)).toBe(0);
  });

  it('can exceed 100 when over the limit', () => {
    expect(calculateCreditUtilization(1_200_00, 1_000_00)).toBe(120);
  });
});
