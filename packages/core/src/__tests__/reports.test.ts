import { calculateCategoryTotals, calculateMonthlyTrend } from '../reports';

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
