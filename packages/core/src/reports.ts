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

/**
 * First and last calendar day (inclusive, YYYY-MM-DD) of a month.
 * `month` is 0-based (0 = January), matching `Date`.
 */
export function monthDateRange(year: number, month: number): { fromDate: string; toDate: string } {
  return {
    fromDate: formatLocalDate(new Date(year, month, 1)),
    toDate: formatLocalDate(new Date(year, month + 1, 0)),
  };
}

export type ReportEntryKind = 'bill' | 'debt' | 'grocery';

/** One outflow (a bill payment, debt payment, or grocery receipt) as the Reports screens see it. */
export interface ReportEntry {
  id: string;
  kind: ReportEntryKind;
  /** YYYY-MM-DD */
  date: string;
  label: string;
  categoryName: string;
  amountCents: number;
}

export interface EntryCategoryTotal {
  categoryName: string;
  /** Drives the chart color — Groceries always reads as 'grocery', even when it also holds bill payments. */
  kind: ReportEntryKind;
  totalCents: number;
  count: number;
}

const GROCERIES_NAME = 'groceries';

/**
 * Groups report entries by category name (case-insensitive), highest spend
 * first. Grocery receipts and bill payments filed under a "Groceries"
 * category land in the same row, so totals always add up.
 */
export function groupEntriesByCategory(entries: ReportEntry[]): EntryCategoryTotal[] {
  const groups = new Map<string, EntryCategoryTotal>();
  for (const entry of entries) {
    const key = entry.categoryName.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.totalCents += entry.amountCents;
      existing.count += 1;
      if (entry.kind === 'grocery') existing.kind = 'grocery';
    } else {
      groups.set(key, {
        categoryName: entry.categoryName.trim(),
        kind: key === GROCERIES_NAME ? 'grocery' : entry.kind,
        totalCents: entry.amountCents,
        count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.totalCents - a.totalCents);
}

/** Entries in one category (case-insensitive), newest first. `null` returns everything, newest first. */
export function filterEntriesByCategory(
  entries: ReportEntry[],
  categoryName: string | null
): ReportEntry[] {
  const wanted = categoryName?.trim().toLowerCase() ?? null;
  return entries
    .filter((e) => wanted === null || e.categoryName.trim().toLowerCase() === wanted)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Deposits minus withdrawals — what a set of goal-activity rows netted out to. */
export function calculateNetGoalSavings(activity: { kind: string; amountCents: number }[]): number {
  return activity.reduce(
    (sum, a) => sum + (a.kind === 'withdrawal' ? -a.amountCents : a.amountCents),
    0
  );
}

export interface MonthlyOverviewInput {
  incomeCents: number;
  billsCents: number;
  debtCents: number;
  groceriesCents: number;
  /** Net goal deposits for the period; negative values count as zero. */
  savingsCents: number;
}

export type AllocationKey = 'bills' | 'debt' | 'groceries' | 'savings' | 'available';

export interface AllocationSegment {
  key: AllocationKey;
  label: string;
  cents: number;
  /** Share of (outflow + available), 0–100. */
  percent: number;
}

export interface MonthlyOverview {
  incomeCents: number;
  outflowCents: number;
  /** Income minus outflow — can be negative (a calm "watch" state, not an error). */
  netCents: number;
  /** Always in the design system's fixed category order: Bills, Debt, Groceries, Savings, Available. */
  segments: AllocationSegment[];
}

/**
 * Splits a period's income into the design system's five fixed categories.
 * "Available" is whatever income is left after outflow (never negative —
 * overspending shows as a negative `netCents`, not a negative segment).
 */
export function calculateMonthlyOverview(input: MonthlyOverviewInput): MonthlyOverview {
  const savingsCents = Math.max(input.savingsCents, 0);
  const outflowCents = input.billsCents + input.debtCents + input.groceriesCents + savingsCents;
  const availableCents = Math.max(input.incomeCents - outflowCents, 0);
  const total = outflowCents + availableCents;
  const share = (cents: number) => (total > 0 ? (cents / total) * 100 : 0);

  const parts: { key: AllocationKey; label: string; cents: number }[] = [
    { key: 'bills', label: 'Bills', cents: input.billsCents },
    { key: 'debt', label: 'Debt', cents: input.debtCents },
    { key: 'groceries', label: 'Groceries', cents: input.groceriesCents },
    { key: 'savings', label: 'Savings', cents: savingsCents },
    { key: 'available', label: 'Available', cents: availableCents },
  ];

  return {
    incomeCents: input.incomeCents,
    outflowCents,
    netCents: input.incomeCents - outflowCents,
    segments: parts.map((p) => ({ ...p, percent: share(p.cents) })),
  };
}

const ENTRY_KIND_LABELS: Record<ReportEntryKind, string> = {
  bill: 'Bill payment',
  debt: 'Debt payment',
  grocery: 'Grocery receipt',
};

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Serializes report entries to CSV (Date, Type, Category, Label, Amount in
 * dollars), oldest first — exactly the rows the Reports screen is showing,
 * so an export always matches the on-screen filter.
 */
export function entriesToCsv(entries: ReportEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) =>
      [e.date, ENTRY_KIND_LABELS[e.kind], e.categoryName, e.label, (e.amountCents / 100).toFixed(2)]
        .map(csvCell)
        .join(',')
    );
  return ['Date,Type,Category,Label,Amount', ...rows].join('\n');
}
