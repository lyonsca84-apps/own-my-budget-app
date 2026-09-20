import {
  calculateDebtPaidPercent,
  calculatePayoffComparison,
  calculatePayoffGoalPercent,
  calculatePayoffSchedule,
  estimateInterestPaid,
  monthsToPayOff,
  orderDebtsForStrategy,
  suggestedPromoPaymentCents,
  summarizePlanCoverage,
  upcomingPaydays,
  type DebtInput,
} from '../debt';

const debts: DebtInput[] = [
  { id: 'small', balanceCents: 50_000, aprBasisPoints: 1_200, minimumPaymentCents: 2_500 },
  { id: 'big', balanceCents: 500_000, aprBasisPoints: 2_400, minimumPaymentCents: 10_000 },
];

describe('orderDebtsForStrategy', () => {
  it('orders snowball by smallest balance and avalanche by highest APR', () => {
    expect(orderDebtsForStrategy(debts, 'snowball').map((d) => d.id)).toEqual(['small', 'big']);
    expect(orderDebtsForStrategy(debts, 'avalanche').map((d) => d.id)).toEqual(['big', 'small']);
  });

  it('does not mutate its input', () => {
    const copy = [...debts];
    orderDebtsForStrategy(debts, 'avalanche');
    expect(debts).toEqual(copy);
  });
});

describe('calculatePayoffSchedule completion flag', () => {
  it('is completed when everything is paid off', () => {
    expect(calculatePayoffSchedule(debts, 0, 'avalanche').completed).toBe(true);
  });

  it("is not completed when the payment can't outrun interest", () => {
    const stuck: DebtInput[] = [
      { id: 'a', balanceCents: 1_000_000, aprBasisPoints: 2_400, minimumPaymentCents: 1_000 },
    ];
    expect(calculatePayoffSchedule(stuck, 0, 'snowball').completed).toBe(false);
  });
});

describe('monthsToPayOff', () => {
  it('is 0 for a cleared balance and null for no payment', () => {
    expect(monthsToPayOff(0, 1_800, 100)).toBe(0);
    expect(monthsToPayOff(10_000, 1_800, 0)).toBeNull();
  });

  it('divides evenly at 0% APR', () => {
    expect(monthsToPayOff(1_000, 0, 100)).toBe(10);
  });

  it('is null when the payment never covers interest', () => {
    expect(monthsToPayOff(1_000_000, 2_400, 1_000)).toBeNull();
  });
});

describe('calculatePayoffComparison', () => {
  it('shows months and interest saved by paying extra', () => {
    const result = calculatePayoffComparison(debts, 20_000, 'avalanche');
    expect(result.monthsSaved).toBeGreaterThan(0);
    expect(result.interestSavedCents).toBeGreaterThan(0);
    expect(result.withExtra.months).toBeLessThan(result.minimumOnly.months);
  });

  it('returns null savings when the minimums alone never finish', () => {
    const stuck: DebtInput[] = [
      { id: 'a', balanceCents: 1_000_000, aprBasisPoints: 2_400, minimumPaymentCents: 1_000 },
    ];
    const result = calculatePayoffComparison(stuck, 0, 'snowball');
    expect(result.monthsSaved).toBeNull();
    expect(result.interestSavedCents).toBeNull();
  });
});

describe('progress helpers', () => {
  it('calculates percent paid down, clamped, null without a starting balance', () => {
    expect(calculateDebtPaidPercent(10_000, 2_500)).toBe(75);
    expect(calculateDebtPaidPercent(10_000, 20_000)).toBe(0);
    expect(calculateDebtPaidPercent(null, 500)).toBeNull();
    expect(calculateDebtPaidPercent(0, 0)).toBeNull();
  });

  it('calculates progress toward a payoff goal', () => {
    expect(calculatePayoffGoalPercent(10_000, 6_000, 2_000)).toBe(50);
    expect(calculatePayoffGoalPercent(10_000, 1_000, 2_000)).toBe(100);
    expect(calculatePayoffGoalPercent(1_000, 800, 2_000)).toBe(0);
  });
});

describe('suggestedPromoPaymentCents', () => {
  const today = new Date(2026, 8, 20);

  it('spreads the promo balance over the months left, rounded up', () => {
    // Sep 20 2026 -> Dec 31 2026: Sep(partial, counted since day>=), Oct, Nov, Dec = 4
    expect(suggestedPromoPaymentCents(100_000, '2026-12-31', today)).toBe(25_000);
  });

  it('asks for the whole balance once expiry is this month or past', () => {
    expect(suggestedPromoPaymentCents(100_000, '2026-09-25', today)).toBe(100_000);
    expect(suggestedPromoPaymentCents(100_000, '2026-01-01', today)).toBe(100_000);
  });

  it('is null without a promo balance or expiry', () => {
    expect(suggestedPromoPaymentCents(null, '2026-12-31', today)).toBeNull();
    expect(suggestedPromoPaymentCents(100_000, null, today)).toBeNull();
  });
});

describe('estimateInterestPaid', () => {
  it('replays payments oldest-first at the APR', () => {
    // 12% APR = 1%/mo. $1,000 balance: first payment $100 -> $10 interest.
    const result = estimateInterestPaid(100_000, 1_200, [{ amountCents: 10_000 }]);
    expect(result).toEqual({ interestCents: 1_000, principalCents: 9_000 });
  });

  it('never attributes more interest than the payment', () => {
    const result = estimateInterestPaid(100_000, 1_200, [{ amountCents: 500 }]);
    expect(result).toEqual({ interestCents: 500, principalCents: 0 });
  });
});

describe('upcomingPaydays', () => {
  const from = new Date(2026, 8, 20); // Sep 20, 2026

  it('rolls a stale biweekly date forward to the next paydays', () => {
    const paydays = upcomingPaydays(
      [
        {
          id: 's1',
          label: 'Acme',
          amountCents: 200_000,
          frequency: 'biweekly',
          nextPayDate: '2026-09-04',
        },
      ],
      3,
      from
    );
    expect(paydays.map((p) => p.date)).toEqual(['2026-10-02', '2026-10-16', '2026-10-30']);
    expect(paydays[0].key).toBe('s1|2026-10-02');
  });

  it('keeps today as an upcoming payday', () => {
    const paydays = upcomingPaydays(
      [{ id: 's1', label: 'A', amountCents: 1, frequency: 'weekly', nextPayDate: '2026-09-20' }],
      2,
      from
    );
    expect(paydays.map((p) => p.date)).toEqual(['2026-09-20', '2026-09-27']);
  });

  it('clamps monthly pay dates to the month length', () => {
    const paydays = upcomingPaydays(
      [{ id: 's1', label: 'A', amountCents: 1, frequency: 'monthly', nextPayDate: '2026-10-31' }],
      3,
      from
    );
    expect(paydays.map((p) => p.date)).toEqual(['2026-10-31', '2026-11-30', '2026-12-30']);
  });

  it('interleaves sources by date and skips schedules with no date', () => {
    const paydays = upcomingPaydays(
      [
        { id: 'a', label: 'A', amountCents: 1, frequency: 'monthly', nextPayDate: '2026-10-10' },
        { id: 'b', label: 'B', amountCents: 1, frequency: 'monthly', nextPayDate: '2026-10-05' },
        { id: 'c', label: 'C', amountCents: 1, frequency: 'monthly', nextPayDate: null },
      ],
      3,
      from
    );
    expect(paydays.map((p) => p.incomeSourceId)).toEqual(['b', 'a', 'b']);
  });

  it('handles twice-monthly schedules and variable income without looping', () => {
    const twice = upcomingPaydays(
      [
        {
          id: 't',
          label: 'T',
          amountCents: 1,
          frequency: 'twice_monthly',
          nextPayDate: '2026-09-15',
        },
      ],
      3,
      from
    );
    expect(twice.map((p) => p.date)).toEqual(['2026-09-30', '2026-10-15', '2026-10-30']);

    const variable = upcomingPaydays(
      [{ id: 'v', label: 'V', amountCents: 1, frequency: 'variable', nextPayDate: '2026-09-01' }],
      3,
      from
    );
    expect(variable).toEqual([]);
  });
});

describe('summarizePlanCoverage', () => {
  it('reports unplanned, partial, full and over', () => {
    expect(summarizePlanCoverage(10_000, [])).toEqual({ kind: 'unplanned' });
    expect(summarizePlanCoverage(10_000, [{ amountCents: 4_000 }])).toEqual({
      kind: 'partial',
      remainingCents: 6_000,
    });
    expect(summarizePlanCoverage(10_000, [{ amountCents: 10_000 }])).toEqual({ kind: 'full' });
    expect(summarizePlanCoverage(10_000, [{ amountCents: 12_000 }])).toEqual({
      kind: 'over',
      overCents: 2_000,
    });
  });
});
