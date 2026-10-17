import {
  buildChartBars,
  buildImproveTips,
  buildInsights,
  buildSnapshotCards,
  buildTips,
  buildUpcomingBills,
  calculateCashFlow,
  calculateDebtProgress,
  calculateMonthlyHealth,
  calculateVariableSpendingCents,
  countPaydaysInMonth,
  describeChange,
  describeScoreChange,
  goalBarTone,
  monthlySavingsGoalCents,
  monthsForRange,
  projectMonthIncomeCents,
} from '../dashboard';

describe('countPaydaysInMonth', () => {
  it('counts weekly paydays rolled forward and back from the anchor', () => {
    // Fridays in Sept 2026: 4, 11, 18, 25
    expect(countPaydaysInMonth('weekly', '2026-09-25', 2026, 8)).toBe(4);
    // Oct 2026 has Fridays 2, 9, 16, 23, 30
    expect(countPaydaysInMonth('weekly', '2026-09-25', 2026, 9)).toBe(5);
    // Rolled back to a past month (Jan 2026 Fridays: 2, 9, 16, 23, 30)
    expect(countPaydaysInMonth('weekly', '2026-09-25', 2026, 0)).toBe(5);
  });

  it('counts biweekly paydays in either 2 or 3 per month', () => {
    // 2026-09-05 biweekly: Sep 5, 19 (2); Oct 3, 17, 31 (3)
    expect(countPaydaysInMonth('biweekly', '2026-09-05', 2026, 8)).toBe(2);
    expect(countPaydaysInMonth('biweekly', '2026-09-05', 2026, 9)).toBe(3);
    expect(countPaydaysInMonth('biweekly', '2026-09-05', 2026, 7)).toBe(2);
  });

  it('is one for monthly, two for twice-monthly, and only the stated date for variable', () => {
    expect(countPaydaysInMonth('monthly', null, 2026, 8)).toBe(1);
    expect(countPaydaysInMonth('twice_monthly', '2026-09-01', 2026, 3)).toBe(2);
    expect(countPaydaysInMonth('variable', '2026-09-12', 2026, 8)).toBe(1);
    expect(countPaydaysInMonth('variable', '2026-09-12', 2026, 9)).toBe(0);
  });

  it('is zero without an anchor date for cadence-based schedules', () => {
    expect(countPaydaysInMonth('weekly', null, 2026, 8)).toBe(0);
  });
});

describe('projectMonthIncomeCents', () => {
  it('sums active schedules and skips archived ones', () => {
    const total = projectMonthIncomeCents(
      [
        { frequency: 'weekly', nextPayDate: '2026-09-25', amountCents: 250_000 },
        { frequency: 'monthly', nextPayDate: '2026-10-01', amountCents: 90_000 },
        { frequency: 'monthly', nextPayDate: null, amountCents: 999_999, isActive: false },
      ],
      2026,
      8
    );
    expect(total).toBe(4 * 250_000 + 90_000);
  });
});

describe('describeChange', () => {
  it('has a calm message with nothing to compare', () => {
    expect(describeChange(100, null)).toEqual({
      text: 'No previous month to compare',
      tone: 'neutral',
    });
  });

  it('reads "more" as good when more is good', () => {
    expect(describeChange(1_940_000, 2_065_000)).toEqual({
      text: '$1,250.00 less than last month',
      tone: 'watch',
    });
    expect(describeChange(2_065_000, 1_940_000).tone).toBe('good');
  });

  it('is neutral when unchanged', () => {
    expect(describeChange(500, 500)).toEqual({ text: 'Same as last month', tone: 'neutral' });
  });

  it('flips the direction when less is good', () => {
    expect(describeChange(100, 200, false).tone).toBe('good');
    expect(describeChange(300, 200, false).tone).toBe('watch');
  });
});

describe('calculateCashFlow', () => {
  it('splits income into bar segments and reports remaining money', () => {
    const flow = calculateCashFlow({
      incomeCents: 1_940_000,
      billsCents: 189_400,
      debtCents: 447_869,
      variableCents: 0,
      savingsCents: 0,
    });
    expect(flow.availableCents).toBe(1_302_731);
    expect(flow.segments.map((s) => s.key)).toEqual([
      'bills',
      'debt',
      'variable',
      'savings',
      'available',
    ]);
    const total = flow.segments.reduce((s, x) => s + x.percent, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(Math.round(flow.segments[4].percent)).toBe(67);
  });

  it('keeps a negative remainder as a signed figure but never a negative segment', () => {
    const flow = calculateCashFlow({
      incomeCents: 100_000,
      billsCents: 150_000,
      debtCents: 0,
      variableCents: 0,
      savingsCents: -500,
    });
    expect(flow.availableCents).toBe(-50_000);
    expect(flow.segments.find((s) => s.key === 'available')?.cents).toBe(0);
    expect(flow.segments.find((s) => s.key === 'savings')?.cents).toBe(0);
  });

  it('has all-zero percents with no data', () => {
    const flow = calculateCashFlow({
      incomeCents: 0,
      billsCents: 0,
      debtCents: 0,
      variableCents: 0,
      savingsCents: 0,
    });
    expect(flow.segments.every((s) => s.percent === 0)).toBe(true);
  });
});

describe('calculateVariableSpendingCents', () => {
  it('does not double-count bill payments already in a category', () => {
    const rows = [
      { categoryId: 'housing', actualCents: 145_000 }, // rent, paid as a bill
      { categoryId: 'food', actualCents: 30_000 },
    ];
    expect(calculateVariableSpendingCents(rows, { housing: 145_000 })).toBe(30_000);
  });

  it('includes uncategorized outflow and never goes negative per category', () => {
    const rows = [{ categoryId: 'a', actualCents: 1_000 }];
    expect(calculateVariableSpendingCents(rows, { a: 5_000 }, 2_500)).toBe(2_500);
  });
});

describe('monthsForRange / buildChartBars', () => {
  it('returns months oldest first across a year boundary', () => {
    expect(monthsForRange('quarter', 2026, 0)).toEqual([
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2026, month: 0 },
    ]);
    expect(monthsForRange('month', 2026, 8)).toEqual([{ year: 2026, month: 8 }]);
  });

  it('runs "This Year" from January to the selected month', () => {
    const months = monthsForRange('year', 2026, 8);
    expect(months).toHaveLength(9);
    expect(months[0]).toEqual({ year: 2026, month: 0 });
    expect(months[8]).toEqual({ year: 2026, month: 8 });
  });

  it('scales bars to the tallest value', () => {
    const bars = buildChartBars([
      { year: 2026, month: 6, incomeCents: 200, spendCents: 100 },
      { year: 2026, month: 7, incomeCents: 100, spendCents: 0 },
    ]);
    expect(bars[0]).toMatchObject({ incomePercent: 100, spendPercent: 50 });
    expect(bars[1]).toMatchObject({ incomePercent: 50, spendPercent: 0 });
  });

  it('does not divide by zero with empty data', () => {
    const bars = buildChartBars([{ year: 2026, month: 8, incomeCents: 0, spendCents: 0 }]);
    expect(bars[0].incomePercent).toBe(0);
  });
});

describe('calculateMonthlyHealth', () => {
  const base = {
    incomeCents: 1_000_000,
    budgetActualCents: 0,
    budgetPlannedCents: 0,
    billsCount: 0,
    billsTotalCents: 0,
    billsPaidCents: 0,
    overdueBillsCount: 0,
    debtDueCents: 0,
    debtPaidCents: 0,
    savedCents: 0,
    savingsGoalCents: 0,
  };

  it('scores a fully on-track month as excellent', () => {
    const health = calculateMonthlyHealth({
      ...base,
      billsCount: 2,
      billsTotalCents: 100_000,
      billsPaidCents: 100_000,
      budgetPlannedCents: 300_000,
      budgetActualCents: 100_000,
      savingsGoalCents: 50_000,
      savedCents: 50_000,
      debtDueCents: 20_000,
      debtPaidCents: 20_000,
    });
    expect(health.band).toBe('excellent');
    expect(health.score).toBeGreaterThanOrEqual(85);
  });

  it('drops when bills are overdue and nothing is paid', () => {
    const health = calculateMonthlyHealth({
      ...base,
      incomeCents: 0,
      billsCount: 2,
      billsTotalCents: 100_000,
      billsPaidCents: 0,
      overdueBillsCount: 1,
      budgetPlannedCents: 100_000,
      budgetActualCents: 400_000,
      debtDueCents: 20_000,
    });
    expect(health.score).toBeLessThan(30);
    expect(health.band).toBe('needsAttention');
  });

  it('stays within 0–100 with no data at all', () => {
    const health = calculateMonthlyHealth({ ...base, incomeCents: 0 });
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });

  it('describes the change against last month', () => {
    expect(describeScoreChange(56, 53)).toEqual({
      text: 'Up 3 points from last month',
      tone: 'good',
    });
    expect(describeScoreChange(50, 51)).toEqual({
      text: 'Down 1 point from last month',
      tone: 'watch',
    });
    expect(describeScoreChange(50, 50).tone).toBe('neutral');
    expect(describeScoreChange(50, null).text).toBe('No previous month to compare');
  });
});

describe('buildImproveTips', () => {
  it('leads with overdue bills and caps at three', () => {
    const tips = buildImproveTips({
      overdueBillsCount: 1,
      budgetActualCents: 200_000,
      budgetPlannedCents: 100_000,
      savedCents: 0,
      savingsGoalCents: 80_000,
      billsUnpaidCents: 50_000,
    });
    expect(tips).toHaveLength(3);
    expect(tips[0]).toMatch(/1 overdue bill to/);
    expect(tips[1]).toMatch(/\$1,000.00 over plan/);
  });

  it('has an encouraging fallback', () => {
    const tips = buildImproveTips({
      overdueBillsCount: 0,
      budgetActualCents: 0,
      budgetPlannedCents: 0,
      savedCents: 0,
      savingsGoalCents: 0,
      billsUnpaidCents: 0,
    });
    expect(tips[0]).toMatch(/on plan/);
  });
});

describe('buildSnapshotCards', () => {
  const input = {
    billsCount: 6,
    billsPaidCount: 2,
    overdueBillsCount: 1,
    budgetActualCents: 0,
    budgetPlannedCents: 326_500,
    savedCents: 0,
    savingsGoalCents: 80_000,
    cardBalanceCents: 3_419_652,
    cardStartingCents: 3_419_652,
    cardPaidCents: 0,
    loanMonthlyCents: 369_969,
    loanBalanceCents: 100,
    loanPaidCents: 250_000,
    nextLoanDueLabel: null,
    availableCents: 1_302_731,
  };

  it('builds the six cards in design order', () => {
    const cards = buildSnapshotCards(input);
    expect(cards.map((c) => c.key)).toEqual([
      'bills',
      'budget',
      'savings',
      'cards',
      'loans',
      'safe',
    ]);
    expect(cards[0]).toMatchObject({ value: '33%', badge: 'Needs Attention', tone: 'danger' });
    expect(cards[0].lines).toEqual(['2 paid', '4 remaining']);
    expect(cards[1]).toMatchObject({ value: '0%', badge: 'On Track' });
    expect(cards[2]).toMatchObject({ value: '0%', badge: 'Needs Attention', tone: 'warning' });
    expect(cards[3]).toMatchObject({ value: '$34,196.52', badge: 'Needs Attention' });
    expect(cards[4].lines[1]).toBe('Next due not set');
    expect(cards[5]).toMatchObject({ value: '$13,027.31', badge: 'On Track' });
  });

  it('treats overspending as an amber watch, not clay', () => {
    const cards = buildSnapshotCards({ ...input, budgetActualCents: 400_000 });
    expect(cards[1]).toMatchObject({ badge: 'Over Budget', tone: 'warning', value: '123%' });
    expect(cards[1].lines[1]).toBe('$0.00 remaining');
  });

  it('shows dashes when there is nothing to divide by', () => {
    const cards = buildSnapshotCards({
      ...input,
      billsCount: 0,
      billsPaidCount: 0,
      overdueBillsCount: 0,
      budgetPlannedCents: 0,
      savingsGoalCents: 0,
    });
    expect(cards[0].value).toBe('—');
    expect(cards[1].value).toBe('—');
    expect(cards[2].value).toBe('—');
  });

  it('reports a fully paid month', () => {
    const cards = buildSnapshotCards({ ...input, billsPaidCount: 6, overdueBillsCount: 0 });
    expect(cards[0]).toMatchObject({ value: '100%', badge: 'Paid', tone: 'success' });
  });
});

describe('buildUpcomingBills', () => {
  const today = new Date('2026-09-20T12:00:00');
  const bills = [
    {
      id: 'rent',
      label: 'Rent',
      categoryName: 'Housing',
      amountCents: 145_000,
      paidCents: 145_000,
      dueDate: '2026-09-01',
    },
    {
      id: 'elec',
      label: 'Electric',
      categoryName: 'Utilities',
      amountCents: 14_500,
      paidCents: 0,
      dueDate: '2026-09-23',
    },
    {
      id: 'net',
      label: 'Internet',
      categoryName: null,
      amountCents: 7_000,
      paidCents: 3_500,
      dueDate: '2026-09-25',
    },
    {
      id: 'phone',
      label: 'Phone',
      categoryName: 'Utilities',
      amountCents: 8_500,
      paidCents: 0,
      dueDate: '2026-09-14',
    },
  ];

  it('puts unpaid bills first by due date, paid last, with design labels', () => {
    const list = buildUpcomingBills(bills, today);
    expect(list.map((b) => b.id)).toEqual(['phone', 'elec', 'net', 'rent']);
    expect(list.map((b) => b.statusLabel)).toEqual([
      'Past Due',
      'Upcoming',
      'Partially Paid',
      'Paid',
    ]);
  });

  it('shows what is still owed, zero once paid, and a fallback category', () => {
    const list = buildUpcomingBills(bills, today);
    expect(list.find((b) => b.id === 'net')).toMatchObject({
      amountDueCents: 3_500,
      category: 'Bill',
    });
    expect(list.find((b) => b.id === 'rent')?.amountDueCents).toBe(0);
  });

  it('limits the list', () => {
    expect(buildUpcomingBills(bills, today, 2)).toHaveLength(2);
  });
});

describe('savings helpers', () => {
  const today = new Date('2026-09-20T12:00:00');

  it("sums each open goal's monthly pace and skips finished ones", () => {
    const total = monthlySavingsGoalCents(
      [
        { savedCents: 320_000, targetCents: 600_000, targetDate: '2027-06-01' },
        { savedCents: 120_000, targetCents: 120_000, targetDate: '2026-08-01' },
        { savedCents: 0, targetCents: 100_000, targetDate: null },
      ],
      today
    );
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(280_000);
  });

  it('steps the goal bar tone up with progress', () => {
    expect(goalBarTone(10)).toBe('primary');
    expect(goalBarTone(30)).toBe('accent');
    expect(goalBarTone(60)).toBe('energy');
    expect(goalBarTone(95)).toBe('success');
  });
});

describe('calculateDebtProgress', () => {
  const debts = [
    {
      id: 'a',
      label: 'Small card',
      balanceCents: 20_000,
      startingBalanceCents: 20_000,
      totalPaidCents: 0,
      aprBasisPoints: 1_000,
      minimumPaymentCents: 2_500,
    },
    {
      id: 'b',
      label: 'Mortgage',
      balanceCents: 33_750_000,
      startingBalanceCents: 34_000_000,
      totalPaidCents: 250_000,
      aprBasisPoints: 500,
      minimumPaymentCents: 236_800,
    },
    {
      id: 'c',
      label: 'Cleared',
      balanceCents: 0,
      startingBalanceCents: 0,
      totalPaidCents: 0,
      aprBasisPoints: 0,
      minimumPaymentCents: 0,
    },
  ];

  it('totals balance, paid and reduction and clamps the percent', () => {
    const p = calculateDebtProgress(debts, 'snowball');
    expect(p.totalBalanceCents).toBe(33_770_000);
    expect(p.paidCents).toBe(250_000);
    expect(p.reducedCents).toBe(250_000);
    expect(p.percentCleared).toBeGreaterThanOrEqual(0);
    expect(p.percentCleared).toBeLessThanOrEqual(100);
  });

  it('picks the next focus by strategy', () => {
    expect(calculateDebtProgress(debts, 'snowball').nextFocusLabel).toBe('Small card');
    expect(calculateDebtProgress(debts, 'avalanche').nextFocusLabel).toBe('Small card');
    const flipped = debts.map((d) => (d.id === 'b' ? { ...d, aprBasisPoints: 2_500 } : d));
    expect(calculateDebtProgress(flipped, 'avalanche').nextFocusLabel).toBe('Mortgage');
  });

  it('has no focus and 0% when nothing is owed', () => {
    const p = calculateDebtProgress([], 'snowball');
    expect(p).toMatchObject({ totalBalanceCents: 0, percentCleared: 0, nextFocusLabel: null });
  });

  it('never reports a negative reduction when a balance grew', () => {
    const p = calculateDebtProgress(
      [{ ...debts[0], balanceCents: 30_000, startingBalanceCents: 20_000 }],
      'snowball'
    );
    expect(p.reducedCents).toBe(0);
    expect(p.percentCleared).toBe(0);
  });
});

describe('buildInsights', () => {
  it('phrases real numbers and caps at three', () => {
    const insights = buildInsights({
      billsCount: 6,
      billsTotalCents: 189_400,
      billsPaidCents: 151_500,
      previousVariableCents: 310_000,
      variableCents: 0,
      savedCents: 0,
      savingsGoalCents: 80_000,
      overdueBillsCount: 1,
      availableCents: 100,
      previousAvailableCents: 0,
    });
    expect(insights).toHaveLength(3);
    expect(insights[0]).toBe("You have paid 80% of this month's bill total.");
    expect(insights[1]).toBe('Your variable spending is $3,100.00 lower than last month.');
    expect(insights[2]).toBe("You are $800.00 away from this month's savings goal.");
  });

  it('is empty with nothing to say', () => {
    expect(
      buildInsights({
        billsCount: 0,
        billsTotalCents: 0,
        billsPaidCents: 0,
        previousVariableCents: null,
        variableCents: 0,
        savedCents: 0,
        savingsGoalCents: 0,
        overdueBillsCount: 0,
        availableCents: 0,
        previousAvailableCents: null,
      })
    ).toEqual([]);
  });
});

describe('buildTips', () => {
  it('builds tips from real numbers and always ends with a general one', () => {
    const tips = buildTips({
      categories: [
        { name: 'Food', currentCents: 8_200, previousCents: 10_000 },
        { name: 'Shopping', currentCents: 5_000, previousCents: 5_000 },
      ],
      unpaidManualBills: [{ label: 'Electric' }],
      emergencyFund: { label: 'Emergency Fund', remainingCents: 280_000, monthlyPaceCents: 40_000 },
      paychecksPerMonth: 2,
    });
    expect(tips[0]).toBe(
      'You spent 18% less on Food this month than last — nice work staying on plan.'
    );
    expect(tips[1]).toMatch(/autopay for your Electric bill/);
    expect(tips[2]).toMatch(/\$25 more per paycheck into your Emergency Fund .* month(s)? sooner/);
    expect(tips[tips.length - 1]).toMatch(/Recording each expense/);
  });

  it('frames more spending as a calm look, not a warning', () => {
    const tips = buildTips({
      categories: [{ name: 'Food', currentCents: 12_000, previousCents: 10_000 }],
      unpaidManualBills: [],
      emergencyFund: null,
      paychecksPerMonth: 2,
    });
    expect(tips[0]).toMatch(/20% more on Food/);
    expect(tips[0]).toMatch(/worth a quick look/);
  });

  it('always has at least one tip', () => {
    expect(
      buildTips({
        categories: [],
        unpaidManualBills: [],
        emergencyFund: null,
        paychecksPerMonth: 0,
      }).length
    ).toBeGreaterThan(0);
  });
});
