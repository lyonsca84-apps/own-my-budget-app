import { parseLocalDate, formatLocalDate } from './dates';

/**
 * Report math — pure, deterministic. Covers PLAN.md screens #58-60
 * (spending by category, income vs. expenses trend, debt & savings
 * progress). Built on real recorded data (bill/debt payments, goal
 * activity, paychecks) rather than the currently-unused generic
 * `transactions` table, since that's what the app's existing screens
 * actually populate.
 */

export interface CategorizedAmount {
  categoryId: string | null;
  amountCents: number;
}

export interface CategoryTotal {
  categoryId: string | null;
  categoryName: string;
  totalCents: number;
}

const UNCATEGORIZED_LABEL = 'Uncategorized';

/**
 * Groups amounts by category, sorted highest-spend first. A null
 * categoryId (or one with no matching entry in `categories`) is bucketed
 * as "Uncategorized" rather than dropped, so totals always add up.
 */
export function calculateCategoryTotals(
  items: CategorizedAmount[],
  categories: { id: string; name: string }[]
): CategoryTotal[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string | null, number>();

  for (const item of items) {
    const key = item.categoryId && nameById.has(item.categoryId) ? item.categoryId : null;
    totals.set(key, (totals.get(key) ?? 0) + item.amountCents);
  }

  return Array.from(totals.entries())
    .map(([categoryId, totalCents]) => ({
      categoryId,
      categoryName: categoryId
        ? (nameById.get(categoryId) ?? UNCATEGORIZED_LABEL)
        : UNCATEGORIZED_LABEL,
      totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export interface DatedAmount {
  /** A YYYY-MM-DD date-only string, e.g. a bill_payment's paid_on. */
  occurredOn: string;
  amountCents: number;
}

export interface MonthlyTotal {
  /** YYYY-MM */
  month: string;
  totalCents: number;
}

function monthKey(date: Date): string {
  return formatLocalDate(date).slice(0, 7);
}

/**
 * Buckets amounts into calendar months for the trailing `monthsBack` months
 * (inclusive of the current month), always returning one entry per month
 * in chronological order — including months with zero activity — so a
 * chart never has to guess whether a gap means "no data" or "no month."
 */
export function calculateMonthlyTrend(
  entries: DatedAmount[],
  monthsBack: number,
  asOf: Date = new Date()
): MonthlyTotal[] {
  const buckets = new Map<string, number>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const bucketDate = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    buckets.set(monthKey(bucketDate), 0);
  }

  for (const entry of entries) {
    const key = monthKey(parseLocalDate(entry.occurredOn));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + entry.amountCents);
    }
  }

  return Array.from(buckets.entries()).map(([month, totalCents]) => ({ month, totalCents }));
}
