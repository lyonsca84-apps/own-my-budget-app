import {
  deriveBillStatus,
  calculateMoneyLeftToSpend,
  calculatePlannedVsActual,
  calculateBudgetRollover,
  assignPaycheck,
  calculateIncomeTotal,
  calculateExpenseTotal,
  generatePaydays,
  buildBudgetRows,
  summarizeBudget,
} from '../budgeting';

describe('deriveBillStatus', () => {
  const today = new Date('2026-09-15T12:00:00');

  it('is paid when the full amount has been paid', () => {
    expect(deriveBillStatus(10_000, 10_000, '2026-09-10', today)).toEqual({
      status: 'paid',
      remainingCents: 0,
    });
  });

  it('is paid when overpaid', () => {
    expect(deriveBillStatus(10_000, 12_000, '2026-09-10', today).status).toBe('paid');
  });

  it('is upcoming when unpaid and due date is in the future', () => {
    expect(deriveBillStatus(10_000, 0, '2026-09-20', today)).toEqual({
      status: 'upcoming',
      remainingCents: 10_000,
    });
  });

  it('is overdue when unpaid and due date has passed', () => {
    expect(deriveBillStatus(10_000, 0, '2026-09-10', today)).toEqual({
      status: 'overdue',
      remainingCents: 10_000,
    });
  });

  it('is overdue with the remaining balance when partially paid past due', () => {
    expect(deriveBillStatus(10_000, 4_000, '2026-09-10', today)).toEqual({
      status: 'overdue',
      remainingCents: 6_000,
    });
  });

  it('is upcoming with the remaining balance when partially paid before due', () => {
    expect(deriveBillStatus(10_000, 4_000, '2026-09-20', today)).toEqual({
      status: 'upcoming',
      remainingCents: 6_000,
    });
  });

  it('treats the due date as due at end of day, not start of day', () => {
    // Due "today" at 23:59:59 — not yet overdue at noon.
    expect(deriveBillStatus(10_000, 0, '2026-09-15', today).status).toBe('upcoming');
  });
});

describe('calculateMoneyLeftToSpend', () => {
  it('subtracts unpaid bills from the bank balance', () => {
    const result = calculateMoneyLeftToSpend({ balanceCents: 100_000, unpaidBillsCents: 30_000 });
    expect(result.totalCents).toBe(70_000);
    expect(result.breakdown).toEqual([
      { label: 'Bank balance', amountCents: 100_000 },
      { label: 'Unpaid bills', amountCents: -30_000 },
    ]);
  });

  it('can go negative when bills exceed the balance', () => {
    expect(
      calculateMoneyLeftToSpend({ balanceCents: 10_000, unpaidBillsCents: 30_000 }).totalCents
    ).toBe(-20_000);
  });
});

describe('calculatePlannedVsActual', () => {
  it('sums only outflow transactions per category', () => {
    const result = calculatePlannedVsActual(
      [{ categoryId: 'groceries', label: 'Groceries', plannedCents: 40_000 }],
      [
        { categoryId: 'groceries', amountCents: -8_000 },
        { categoryId: 'groceries', amountCents: -12_000 },
        { categoryId: 'groceries', amountCents: 5_000 }, // a refund — not spending
        { categoryId: 'other', amountCents: -1_000 }, // different category — ignored
      ]
    );
    expect(result).toEqual([
      {
        categoryId: 'groceries',
        label: 'Groceries',
        plannedCents: 40_000,
        actualCents: 20_000,
        remainingCents: 20_000,
      },
    ]);
  });

  it('reports negative remaining when overspent', () => {
    const result = calculatePlannedVsActual(
      [{ categoryId: 'dining', label: 'Dining', plannedCents: 5_000 }],
      [{ categoryId: 'dining', amountCents: -7_500 }]
    );
    expect(result[0].remainingCents).toBe(-2_500);
  });

  it('returns zero actual for a category with no transactions', () => {
    const result = calculatePlannedVsActual(
      [{ categoryId: 'savings', label: 'Savings', plannedCents: 10_000 }],
      []
    );
    expect(result[0]).toMatchObject({ actualCents: 0, remainingCents: 10_000 });
  });
});

describe('calculateBudgetRollover', () => {
  it('carries leftover as a positive rollover', () => {
    expect(calculateBudgetRollover([{ categoryId: 'a', remainingCents: 5_000 }])).toEqual([
      { categoryId: 'a', rolloverCents: 5_000 },
    ]);
  });

  it('carries overspend as a negative rollover', () => {
    expect(calculateBudgetRollover([{ categoryId: 'a', remainingCents: -2_000 }])).toEqual([
      { categoryId: 'a', rolloverCents: -2_000 },
    ]);
  });
});

describe('assignPaycheck', () => {
  it('is valid when allocations exactly match the paycheck', () => {
    const result = assignPaycheck(100_000, [
      { categoryId: 'rent', amountCents: 60_000 },
      { categoryId: 'groceries', amountCents: 40_000 },
    ]);
    expect(result).toEqual({
      totalAllocatedCents: 100_000,
      remainingCents: 0,
      isOverAllocated: false,
    });
  });

  it('reports remaining when under-allocated', () => {
    const result = assignPaycheck(100_000, [{ categoryId: 'rent', amountCents: 60_000 }]);
    expect(result.remainingCents).toBe(40_000);
    expect(result.isOverAllocated).toBe(false);
  });

  it('flags over-allocation without throwing', () => {
    const result = assignPaycheck(100_000, [{ categoryId: 'rent', amountCents: 120_000 }]);
    expect(result.isOverAllocated).toBe(true);
    expect(result.remainingCents).toBe(-20_000);
  });

  it('handles zero allocations', () => {
    expect(assignPaycheck(50_000, [])).toEqual({
      totalAllocatedCents: 0,
      remainingCents: 50_000,
      isOverAllocated: false,
    });
  });
});

describe('calculateIncomeTotal / calculateExpenseTotal', () => {
  const entries = [{ amountCents: 200_000 }, { amountCents: -50_000 }, { amountCents: -30_000 }];

  it('sums only positive amounts for income', () => {
    expect(calculateIncomeTotal(entries)).toBe(200_000);
  });

  it('sums only negative amounts (as a positive total) for expenses', () => {
    expect(calculateExpenseTotal(entries)).toBe(80_000);
  });

  it('returns zero for an empty list', () => {
    expect(calculateIncomeTotal([])).toBe(0);
    expect(calculateExpenseTotal([])).toBe(0);
  });
});

describe('generatePaydays', () => {
  const from = new Date(2026, 8, 20); // Sep 20, 2026

  it('rolls a past biweekly anchor forward to the next upcoming payday', () => {
    expect(generatePaydays('biweekly', '2026-09-04', 3, from)).toEqual([
      '2026-10-02',
      '2026-10-16',
      '2026-10-30',
    ]);
  });

  it('includes the from date itself when it lands on a payday', () => {
    expect(generatePaydays('weekly', '2026-09-06', 2, from)).toEqual(['2026-09-20', '2026-09-27']);
  });

  it('starts at a future anchor', () => {
    expect(generatePaydays('biweekly', '2026-09-25', 2, from)).toEqual([
      '2026-09-25',
      '2026-10-09',
    ]);
  });

  it('projects monthly paydays, clamping to short months', () => {
    expect(generatePaydays('monthly', '2026-01-31', 3, from)).toEqual([
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
    ]);
  });

  it('projects twice-monthly paydays 15 days apart within a month', () => {
    expect(generatePaydays('twice_monthly', '2026-09-01', 4, from)).toEqual([
      '2026-10-01',
      '2026-10-16',
      '2026-11-01',
      '2026-11-16',
    ]);
  });

  it('returns only the stated date for a variable schedule, and only if upcoming', () => {
    expect(generatePaydays('variable', '2026-10-05', 3, from)).toEqual(['2026-10-05']);
    expect(generatePaydays('variable', '2026-09-01', 3, from)).toEqual([]);
  });

  it('returns nothing without an anchor date or a positive count', () => {
    expect(generatePaydays('biweekly', null, 3, from)).toEqual([]);
    expect(generatePaydays('biweekly', '2026-09-25', 0, from)).toEqual([]);
  });
});

describe('buildBudgetRows / summarizeBudget', () => {
  const categories = [
    { id: 'rent', name: 'Rent' },
    { id: 'food', name: 'Groceries' },
    { id: 'fun', name: 'Fun' },
    { id: 'misc', name: 'Misc' },
  ];

  it('derives planned, actual, remaining, percent and state per category', () => {
    const rows = buildBudgetRows(
      categories,
      [
        { categoryId: 'rent', plannedCents: 100_000, actualOverrideCents: null },
        { categoryId: 'food', plannedCents: 50_000, actualOverrideCents: null },
        { categoryId: 'fun', plannedCents: 10_000, actualOverrideCents: null },
      ],
      [
        { categoryId: 'rent', amountCents: 50_000 },
        { categoryId: 'food', amountCents: 45_000 },
        { categoryId: 'food', amountCents: 10_000 },
        { categoryId: 'fun', amountCents: 9_000 },
        { categoryId: 'misc', amountCents: 2_000 },
        { categoryId: null, amountCents: 999 },
      ]
    );
    expect(rows.map((r) => [r.name, r.actualCents, r.state, r.percentUsed])).toEqual([
      ['Rent', 50_000, 'on-track', 50],
      ['Groceries', 55_000, 'over', 110],
      ['Fun', 9_000, 'near', 90],
      ['Misc', 2_000, 'unplanned', null],
    ]);
    expect(rows[1].overCents).toBe(5_000);
    expect(rows[1].remainingCents).toBe(-5_000);
    expect(rows[0].overCents).toBe(0);
  });

  it('lets an override replace the tracked amount, including a zero override', () => {
    const rows = buildBudgetRows(
      categories.slice(0, 2),
      [
        { categoryId: 'rent', plannedCents: 100_000, actualOverrideCents: 0 },
        { categoryId: 'food', plannedCents: 50_000, actualOverrideCents: 20_000 },
      ],
      [
        { categoryId: 'rent', amountCents: 100_000 },
        { categoryId: 'food', amountCents: 45_000 },
      ]
    );
    expect(rows[0]).toMatchObject({ actualCents: 0, trackedCents: 100_000, isOverridden: true });
    expect(rows[1]).toMatchObject({
      actualCents: 20_000,
      trackedCents: 45_000,
      isOverridden: true,
    });
  });

  it('summarizes the whole period', () => {
    const rows = buildBudgetRows(
      categories.slice(0, 2),
      [
        { categoryId: 'rent', plannedCents: 100_000, actualOverrideCents: null },
        { categoryId: 'food', plannedCents: 50_000, actualOverrideCents: null },
      ],
      [
        { categoryId: 'rent', amountCents: 100_000 },
        { categoryId: 'food', amountCents: 60_000 },
      ]
    );
    expect(summarizeBudget(rows)).toEqual({
      plannedCents: 150_000,
      actualCents: 160_000,
      remainingCents: -10_000,
      overCategoryCount: 1,
      percentUsed: 107,
    });
    expect(summarizeBudget([]).percentUsed).toBeNull();
  });
});
