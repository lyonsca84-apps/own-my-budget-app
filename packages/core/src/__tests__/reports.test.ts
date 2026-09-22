import {
  calculateCategoryTotals,
  calculateMonthlyOverview,
  calculateMonthlyTrend,
  calculateNetGoalSavings,
  entriesToCsv,
  filterEntriesByCategory,
  groupEntriesByCategory,
  monthDateRange,
  type ReportEntry,
} from '../reports';

describe('calculateCategoryTotals', () => {
  const categories = [
    { id: 'cat-groceries', name: 'Groceries' },
    { id: 'cat-utilities', name: 'Utilities' },
  ];

  it('groups and sums amounts by category, sorted highest first', () => {
    const totals = calculateCategoryTotals(
      [
        { categoryId: 'cat-utilities', amountCents: 5_000 },
        { categoryId: 'cat-groceries', amountCents: 3_000 },
        { categoryId: 'cat-groceries', amountCents: 4_000 },
      ],
      categories
    );
    expect(totals).toEqual([
      { categoryId: 'cat-groceries', categoryName: 'Groceries', totalCents: 7_000 },
      { categoryId: 'cat-utilities', categoryName: 'Utilities', totalCents: 5_000 },
    ]);
  });

  it('buckets a null categoryId as Uncategorized rather than dropping it', () => {
    const totals = calculateCategoryTotals(
      [
        { categoryId: null, amountCents: 1_000 },
        { categoryId: 'cat-groceries', amountCents: 500 },
      ],
      categories
    );
    expect(totals).toEqual([
      { categoryId: null, categoryName: 'Uncategorized', totalCents: 1_000 },
      { categoryId: 'cat-groceries', categoryName: 'Groceries', totalCents: 500 },
    ]);
  });

  it('buckets a categoryId with no matching category (e.g. since archived) as Uncategorized too', () => {
    const totals = calculateCategoryTotals(
      [{ categoryId: 'cat-deleted', amountCents: 100 }],
      categories
    );
    expect(totals).toEqual([{ categoryId: null, categoryName: 'Uncategorized', totalCents: 100 }]);
  });

  it('returns an empty array for no items', () => {
    expect(calculateCategoryTotals([], categories)).toEqual([]);
  });
});

describe('calculateMonthlyTrend', () => {
  // Constructed via (y, m, d), not a bare date string — the latter parses as
  // UTC midnight and can shift a day (and sometimes a month) off in
  // non-UTC timezones.
  const march15 = new Date(2026, 2, 15);

  it('returns one bucket per trailing month, in chronological order, even with no data', () => {
    const trend = calculateMonthlyTrend([], 3, march15);
    expect(trend).toEqual([
      { month: '2026-01', totalCents: 0 },
      { month: '2026-02', totalCents: 0 },
      { month: '2026-03', totalCents: 0 },
    ]);
  });

  it('sums entries into their correct month bucket', () => {
    const trend = calculateMonthlyTrend(
      [
        { occurredOn: '2026-02-01', amountCents: 100 },
        { occurredOn: '2026-02-28', amountCents: 200 },
        { occurredOn: '2026-03-01', amountCents: 50 },
      ],
      3,
      march15
    );
    expect(trend).toEqual([
      { month: '2026-01', totalCents: 0 },
      { month: '2026-02', totalCents: 300 },
      { month: '2026-03', totalCents: 50 },
    ]);
  });

  it('ignores entries older than the trailing window', () => {
    const trend = calculateMonthlyTrend(
      [{ occurredOn: '2025-01-01', amountCents: 999 }],
      3,
      march15
    );
    expect(trend.reduce((sum, m) => sum + m.totalCents, 0)).toBe(0);
  });

  it('correctly spans a year boundary', () => {
    const jan15 = new Date(2026, 0, 15);
    const trend = calculateMonthlyTrend([{ occurredOn: '2025-12-01', amountCents: 500 }], 3, jan15);
    expect(trend).toEqual([
      { month: '2025-11', totalCents: 0 },
      { month: '2025-12', totalCents: 500 },
      { month: '2026-01', totalCents: 0 },
    ]);
  });
});

describe('monthDateRange', () => {
  it('returns the first and last day of a month', () => {
    expect(monthDateRange(2026, 8)).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-30' });
  });

  it('handles February in a leap year and December', () => {
    expect(monthDateRange(2028, 1)).toEqual({ fromDate: '2028-02-01', toDate: '2028-02-29' });
    expect(monthDateRange(2026, 11)).toEqual({ fromDate: '2026-12-01', toDate: '2026-12-31' });
  });
});

describe('groupEntriesByCategory', () => {
  const entries: ReportEntry[] = [
    {
      id: '1',
      kind: 'bill',
      date: '2026-09-01',
      label: 'Rent',
      categoryName: 'Housing',
      amountCents: 100_000,
    },
    {
      id: '2',
      kind: 'grocery',
      date: '2026-09-03',
      label: 'Market',
      categoryName: 'Groceries',
      amountCents: 8_000,
    },
    {
      id: '3',
      kind: 'bill',
      date: '2026-09-04',
      label: 'Store bill',
      categoryName: 'groceries',
      amountCents: 2_000,
    },
    {
      id: '4',
      kind: 'debt',
      date: '2026-09-05',
      label: 'Card',
      categoryName: 'Debt payments',
      amountCents: 5_000,
    },
  ];

  it('groups case-insensitively, highest first, and keeps the grocery color for a merged row', () => {
    expect(groupEntriesByCategory(entries)).toEqual([
      { categoryName: 'Housing', kind: 'bill', totalCents: 100_000, count: 1 },
      { categoryName: 'Groceries', kind: 'grocery', totalCents: 10_000, count: 2 },
      { categoryName: 'Debt payments', kind: 'debt', totalCents: 5_000, count: 1 },
    ]);
  });

  it('returns an empty list for no entries', () => {
    expect(groupEntriesByCategory([])).toEqual([]);
  });

  it('filters by category (case-insensitive) newest first, or returns all for null', () => {
    expect(filterEntriesByCategory(entries, 'GROCERIES').map((e) => e.id)).toEqual(['3', '2']);
    expect(filterEntriesByCategory(entries, null).map((e) => e.id)).toEqual(['4', '3', '2', '1']);
  });
});

describe('calculateNetGoalSavings', () => {
  it('adds deposits and subtracts withdrawals', () => {
    expect(
      calculateNetGoalSavings([
        { kind: 'deposit', amountCents: 5_000 },
        { kind: 'deposit', amountCents: 2_500 },
        { kind: 'withdrawal', amountCents: 1_000 },
      ])
    ).toBe(6_500);
  });
});

describe('calculateMonthlyOverview', () => {
  it('splits income into the five fixed categories in order', () => {
    const overview = calculateMonthlyOverview({
      incomeCents: 100_000,
      billsCents: 40_000,
      debtCents: 10_000,
      groceriesCents: 10_000,
      savingsCents: 10_000,
    });
    expect(overview.segments.map((s) => s.key)).toEqual([
      'bills',
      'debt',
      'groceries',
      'savings',
      'available',
    ]);
    expect(overview.outflowCents).toBe(70_000);
    expect(overview.netCents).toBe(30_000);
    expect(overview.segments.find((s) => s.key === 'available')?.cents).toBe(30_000);
    expect(overview.segments.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(100);
  });

  it('never returns a negative Available segment when spending exceeds income', () => {
    const overview = calculateMonthlyOverview({
      incomeCents: 10_000,
      billsCents: 15_000,
      debtCents: 0,
      groceriesCents: 0,
      savingsCents: -500,
    });
    expect(overview.netCents).toBe(-5_000);
    expect(overview.segments.find((s) => s.key === 'available')?.cents).toBe(0);
    expect(overview.segments.find((s) => s.key === 'savings')?.cents).toBe(0);
  });

  it('returns zero percentages for an empty month', () => {
    const overview = calculateMonthlyOverview({
      incomeCents: 0,
      billsCents: 0,
      debtCents: 0,
      groceriesCents: 0,
      savingsCents: 0,
    });
    expect(overview.segments.every((s) => s.percent === 0)).toBe(true);
  });
});

describe('entriesToCsv', () => {
  it('writes a header plus one oldest-first row per entry, escaping commas and quotes', () => {
    const csv = entriesToCsv([
      {
        id: '2',
        kind: 'grocery',
        date: '2026-09-03',
        label: 'Joe\'s "Market", Main St',
        categoryName: 'Groceries',
        amountCents: 8_050,
      },
      {
        id: '1',
        kind: 'bill',
        date: '2026-09-01',
        label: 'Rent',
        categoryName: 'Housing',
        amountCents: 100_000,
      },
    ]);
    expect(csv.split('\n')).toEqual([
      'Date,Type,Category,Label,Amount',
      '2026-09-01,Bill payment,Housing,Rent,1000.00',
      '2026-09-03,Grocery receipt,Groceries,"Joe\'s ""Market"", Main St",80.50',
    ]);
  });

  it('returns just the header when there are no entries', () => {
    expect(entriesToCsv([])).toBe('Date,Type,Category,Label,Amount');
  });
});
