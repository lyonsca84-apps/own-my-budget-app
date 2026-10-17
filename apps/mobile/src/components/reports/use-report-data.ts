import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listBillPaymentsForReports,
  listCategories,
  listDebtPaymentsForReports,
  listGoalActivityForReports,
  listPaychecks,
  listReceiptsInRange,
} from '@own-my-budget/api';
import {
  DEMO_DATA,
  calculateMonthlyOverview,
  calculateNetGoalSavings,
  groupEntriesByCategory,
  parseLocalDate,
  type EntryCategoryTotal,
  type MonthlyOverview,
  type ReportEntry,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

export interface ReportRange {
  /** Inclusive YYYY-MM-DD; omit either end for an open range. */
  fromDate?: string;
  toDate?: string;
}

export interface ReportData {
  isLoading: boolean;
  /** Guests always see the sample dataset — never real rows. */
  isGuest: boolean;
  errorMessage: string | null;
  entries: ReportEntry[];
  /** Individual income rows (paychecks) in range — the trend report buckets these by month. */
  incomeEntries: { date: string; amountCents: number }[];
  incomeCents: number;
  savingsCents: number;
  overview: MonthlyOverview;
  categoryTotals: EntryCategoryTotal[];
  hasAnyData: boolean;
  refresh: () => void;
}

const DEBT_CATEGORY = 'Debt payments';
const GROCERIES_CATEGORY = 'Groceries';
const UNCATEGORIZED = 'Uncategorized';

function inRange(date: string, range: ReportRange): boolean {
  if (range.fromDate && date < range.fromDate) return false;
  if (range.toDate && date > range.toDate) return false;
  return true;
}

/** The month a guest lands on: the latest one with sample income, so the report isn't empty on first look. */
export function getGuestDefaultMonth(): { month: number; year: number } {
  const latestIncome = DEMO_DATA.transactions
    .filter((t) => t.amountCents > 0)
    .map((t) => t.date)
    .sort()
    .at(-1);
  const date = latestIncome ? parseLocalDate(latestIncome) : new Date();
  return { month: date.getMonth(), year: date.getFullYear() };
}

function buildDemoData(range: ReportRange) {
  const transactions = DEMO_DATA.transactions.filter((t) => inRange(t.date, range));
  const entries: ReportEntry[] = transactions
    .filter((t) => t.amountCents < 0)
    .map((t) => ({
      id: t.id,
      kind: t.category === GROCERIES_CATEGORY ? ('grocery' as const) : ('bill' as const),
      date: t.date,
      label: t.label,
      categoryName: t.category,
      amountCents: -t.amountCents,
    }));
  const incomeEntries = transactions
    .filter((t) => t.amountCents > 0)
    .map((t) => ({ date: t.date, amountCents: t.amountCents }));
  return { entries, incomeEntries, savingsCents: 0 };
}

/**
 * One source of truth for every Reports screen: outflows (bill payments,
 * debt payments, grocery receipts), income (paychecks) and goal deposits
 * for a date range, already grouped and split into the design's five
 * fixed categories. Signed-in accounts get real rows only; guests get the
 * sample dataset. Pass `enabled: false` to skip fetching (e.g. while a plan gate
 * is still locked).
 */
export function useReportData(range: ReportRange, enabled = true): ReportData {
  const { status, user } = useAuth();
  const isGuest = status === 'guest';
  const { fromDate, toDate } = range;
  const [isLoading, setIsLoading] = useState(status === 'signedIn' && enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [real, setReal] = useState<{
    entries: ReportEntry[];
    incomeEntries: { date: string; amountCents: number }[];
    savingsCents: number;
  }>({ entries: [], incomeEntries: [], savingsCents: 0 });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const currentKey = `${fromDate ?? ''}|${toDate ?? ''}`;

  useEffect(() => {
    if (status !== 'signedIn' || !user || !enabled) return;
    let isMounted = true;
    const dates = { fromDate, toDate };

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [billPayments, debtPayments, goalActivity, paychecks, categories, receipts] =
          await Promise.all([
            listBillPaymentsForReports(supabase, user!.id, dates),
            listDebtPaymentsForReports(supabase, user!.id, dates),
            listGoalActivityForReports(supabase, user!.id, dates),
            listPaychecks(supabase, user!.id),
            listCategories(supabase, user!.id),
            listReceiptsInRange(supabase, user!.id, dates),
          ]);
        if (!isMounted) return;

        const nameById = new Map(categories.map((c) => [c.id, c.name]));
        const entries: ReportEntry[] = [
          ...billPayments.map((p, i) => ({
            id: `bill-${i}-${p.paid_on}`,
            kind: 'bill' as const,
            date: p.paid_on,
            label: p.bill_label,
            categoryName: (p.category_id && nameById.get(p.category_id)) || UNCATEGORIZED,
            amountCents: p.amount_cents,
          })),
          ...debtPayments.map((p, i) => ({
            id: `debt-${i}-${p.paid_on}`,
            kind: 'debt' as const,
            date: p.paid_on,
            label: p.debt_label,
            categoryName: DEBT_CATEGORY,
            amountCents: p.amount_cents,
          })),
          ...receipts
            .filter((r) => r.purchased_on && (r.total_cents ?? 0) > 0)
            .map((r) => ({
              id: `receipt-${r.id}`,
              kind: 'grocery' as const,
              date: r.purchased_on!,
              label: r.store_label?.trim() || 'Grocery receipt',
              categoryName: GROCERIES_CATEGORY,
              amountCents: r.total_cents ?? 0,
            })),
        ];

        setReal({
          entries,
          incomeEntries: paychecks
            .filter((p) => inRange(p.pay_date, dates))
            .map((p) => ({ date: p.pay_date, amountCents: p.amount_cents })),
          savingsCents: calculateNetGoalSavings(
            goalActivity.map((a) => ({ kind: a.kind, amountCents: a.amount_cents }))
          ),
        });
      } catch {
        if (isMounted) setErrorMessage("We couldn't load your report just now. Please try again.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setLoadedKey(`${fromDate ?? ''}|${toDate ?? ''}`);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [status, user, enabled, fromDate, toDate, tick]);

  const source = useMemo(
    () => (isGuest ? buildDemoData({ fromDate, toDate }) : real),
    [isGuest, real, fromDate, toDate]
  );

  const derived = useMemo(() => {
    const incomeCents = source.incomeEntries.reduce((sum, e) => sum + e.amountCents, 0);
    const sumKind = (kind: ReportEntry['kind']) =>
      source.entries.filter((e) => e.kind === kind).reduce((sum, e) => sum + e.amountCents, 0);
    return {
      overview: calculateMonthlyOverview({
        incomeCents,
        billsCents: sumKind('bill'),
        debtCents: sumKind('debt'),
        groceriesCents: sumKind('grocery'),
        savingsCents: source.savingsCents,
      }),
      categoryTotals: groupEntriesByCategory(source.entries),
      incomeCents,
    };
  }, [source]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return {
    isLoading: isGuest ? false : isLoading || (enabled && loadedKey !== currentKey),
    isGuest,
    errorMessage,
    entries: source.entries,
    incomeEntries: source.incomeEntries,
    incomeCents: derived.incomeCents,
    savingsCents: source.savingsCents,
    overview: derived.overview,
    categoryTotals: derived.categoryTotals,
    hasAnyData:
      source.entries.length > 0 || derived.incomeCents > 0 || Math.max(source.savingsCents, 0) > 0,
    refresh,
  };
}
