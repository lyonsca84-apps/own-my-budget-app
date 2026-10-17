import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findBudgetPeriod,
  getCurrentAccount,
  getOrCreateBudgetPeriod,
  getPayoffPlan,
  listBillPaymentsForReports,
  listBillsWithPayments,
  listBudgetLines,
  listCategories,
  listDebtPaymentsForReports,
  listDebtsWithPayments,
  listIncomeSources,
  listPaydayAssignments,
  listSavingsGoals,
  listTransactions,
  listUserGoalActivity,
  upsertBudgetLine,
  type Tables,
} from '@own-my-budget/api';
import {
  formatLocalDate,
  monthDateRange,
  type BudgetLineInput,
  type PayoffStrategy,
} from '@own-my-budget/core';

import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  EMPTY_RAW,
  buildDashboardModel,
  monthKey,
  type DashboardModel,
  type RawDashboardData,
} from './model';

export interface DashboardData {
  isGuest: boolean;
  /** True until the first load finishes. Later reloads keep showing the previous numbers. */
  isLoading: boolean;
  errorMessage: string | null;
  clearError: () => void;
  month: number;
  year: number;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
  /** Reloads everything from the database. */
  refresh: () => void;
  today: Date;
  model: DashboardModel;
  savePlanned: (categoryId: string, cents: number) => Promise<void>;
  /** `null` clears a typed-in actual and goes back to the tracked amount. */
  saveActual: (categoryId: string, cents: number | null) => Promise<void>;
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : ((error as { message?: string } | null)?.message ?? 'Something went wrong.');
}

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200';
}

function prevMonthOf(year: number, month: number) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

type BaseData = Pick<
  RawDashboardData,
  | 'displayName'
  | 'categories'
  | 'incomeSources'
  | 'bills'
  | 'debts'
  | 'goals'
  | 'goalActivity'
  | 'payoffStrategy'
  | 'assignments'
  | 'recentTransactionDates'
>;

type WindowData = Pick<
  RawDashboardData,
  'transactions' | 'billPayments' | 'debtPayments' | 'linesByMonth'
>;

const EMPTY_WINDOW: WindowData = {
  transactions: [],
  billPayments: [],
  debtPayments: [],
  linesByMonth: {},
};

/**
 * Loads everything the Dashboard shows through the normal API functions —
 * guests run the very same code against the in-memory sample database — and
 * exposes the two writes the page makes itself (planned / spent amounts per
 * category, saved the same way the Budget page saves them).
 */
export function useDashboardData(): DashboardData {
  const { userId, isReady, isGuest, guestDataVersion } = useDataUser();
  const today = useMemo(() => new Date(), []);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [reloadTick, setReloadTick] = useState(0);
  const [base, setBase] = useState<BaseData | null>(null);
  const [window_, setWindow] = useState<WindowData>(EMPTY_WINDOW);
  const [periodIds, setPeriodIds] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(() => setReloadTick((tick) => tick + 1), []);

  // Coming back from an add/record dialog: pick up whatever it changed.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Everything that isn't month-specific.
  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;

    async function load() {
      try {
        const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
        const [account, categories, incomeSources, bills, debts, goals, goalActivity, recent] =
          await Promise.all([
            getCurrentAccount(supabase, userId!),
            listCategories(supabase, userId!),
            listIncomeSources(supabase, userId!),
            listBillsWithPayments(supabase, userId!),
            listDebtsWithPayments(supabase, userId!),
            listSavingsGoals(supabase, userId!),
            listUserGoalActivity(supabase, userId!),
            listTransactions(supabase, userId!, { fromDate: formatLocalDate(sevenDaysAgo) }),
          ]);
        // Optional pieces that fail soft: an un-migrated database or a missing
        // plan just means "nothing planned yet".
        const [plan, assignments] = await Promise.all([
          getPayoffPlan(supabase, userId!).catch(() => null),
          listPaydayAssignments(supabase, userId!).catch((error) => {
            if (!isMissingTable(error)) throw error;
            return [] as Tables<'payday_assignments'>[];
          }),
        ]);
        if (!isMounted) return;
        setBase({
          displayName: account.profile.display_name?.trim() ?? '',
          categories: [...categories]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((c) => ({ id: c.id, name: c.name })),
          incomeSources,
          bills,
          debts,
          goals,
          goalActivity,
          payoffStrategy: (plan?.strategy === 'avalanche'
            ? 'avalanche'
            : 'snowball') as PayoffStrategy,
          assignments,
          recentTransactionDates: recent
            .filter((t) => t.amount_cents < 0)
            .map((t) => t.occurred_on),
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`Couldn't load your dashboard. ${messageOf(error)}`);
          setBase((current) => current ?? { ...EMPTY_RAW });
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [isReady, userId, guestDataVersion, reloadTick, today]);

  // Month-specific: a rolling window of records (for the chart and last-month
  // deltas) plus the budget lines for this and the previous month.
  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;
    const prev = prevMonthOf(year, month);
    const windowStart = monthDateRange(year, month - 12).fromDate;
    const windowEnd = monthDateRange(year, month).toDate;

    async function loadLines(y: number, m: number) {
      const period = await findBudgetPeriod(supabase, userId!, monthDateRange(y, m).fromDate);
      const lines = period ? await listBudgetLines(supabase, period.id) : [];
      return { period, lines };
    }

    async function load() {
      try {
        const [transactions, billPayments, debtPayments, current, previous] = await Promise.all([
          listTransactions(supabase, userId!, { fromDate: windowStart, toDate: windowEnd }),
          listBillPaymentsForReports(supabase, userId!, {
            fromDate: windowStart,
            toDate: windowEnd,
          }),
          listDebtPaymentsForReports(supabase, userId!, {
            fromDate: windowStart,
            toDate: windowEnd,
          }),
          loadLines(year, month),
          loadLines(prev.year, prev.month),
        ]);
        if (!isMounted) return;
        const toInputs = (lines: Tables<'budget_lines'>[]): BudgetLineInput[] =>
          lines.map((l) => ({
            categoryId: l.category_id,
            plannedCents: l.planned_cents,
            actualOverrideCents: l.actual_override_cents,
          }));
        setWindow({
          transactions,
          billPayments,
          debtPayments,
          linesByMonth: {
            [monthKey(year, month)]: toInputs(current.lines),
            [monthKey(prev.year, prev.month)]: toInputs(previous.lines),
          },
        });
        setPeriodIds((ids) => ({
          ...ids,
          ...(current.period ? { [monthKey(year, month)]: current.period.id } : {}),
        }));
      } catch (error) {
        if (isMounted) setErrorMessage(`Couldn't load this month. ${messageOf(error)}`);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [isReady, userId, guestDataVersion, reloadTick, year, month]);

  const raw = useMemo<RawDashboardData>(
    () => ({ ...(base ?? EMPTY_RAW), ...window_ }),
    [base, window_]
  );
  const model = useMemo(
    () => buildDashboardModel(raw, year, month, today),
    [raw, year, month, today]
  );

  const patchLine = useCallback(
    (key: string, categoryId: string, patch: Partial<BudgetLineInput>) => {
      setWindow((current) => {
        const lines = current.linesByMonth[key] ?? [];
        const exists = lines.some((l) => l.categoryId === categoryId);
        const next = exists
          ? lines.map((l) => (l.categoryId === categoryId ? { ...l, ...patch } : l))
          : [...lines, { categoryId, plannedCents: 0, actualOverrideCents: null, ...patch }];
        return { ...current, linesByMonth: { ...current.linesByMonth, [key]: next } };
      });
    },
    []
  );

  const ensurePeriod = useCallback(async (): Promise<string> => {
    if (!userId) throw new Error('Sign in to edit your budget.');
    const key = monthKey(year, month);
    if (periodIds[key]) return periodIds[key];
    const { fromDate, toDate } = monthDateRange(year, month);
    const period = await getOrCreateBudgetPeriod(supabase, userId, fromDate, toDate);
    setPeriodIds((ids) => ({ ...ids, [key]: period.id }));
    return period.id;
  }, [userId, year, month, periodIds]);

  const savePlanned = useCallback(
    async (categoryId: string, cents: number) => {
      if (!userId) return;
      const key = monthKey(year, month);
      const previous = raw.linesByMonth[key]?.find((l) => l.categoryId === categoryId);
      if ((previous?.plannedCents ?? 0) === cents) return;
      patchLine(key, categoryId, { plannedCents: cents });
      try {
        const id = await ensurePeriod();
        await upsertBudgetLine(supabase, {
          user_id: userId,
          budget_period_id: id,
          category_id: categoryId,
          planned_cents: cents,
        });
        setErrorMessage(null);
      } catch (error) {
        patchLine(key, categoryId, { plannedCents: previous?.plannedCents ?? 0 });
        setErrorMessage(`Couldn't save that planned amount. ${messageOf(error)}`);
      }
    },
    [userId, year, month, raw.linesByMonth, patchLine, ensurePeriod]
  );

  const saveActual = useCallback(
    async (categoryId: string, cents: number | null) => {
      if (!userId) return;
      const key = monthKey(year, month);
      const row = model.categoryRows.find((r) => r.categoryId === categoryId);
      const previous = raw.linesByMonth[key]?.find((l) => l.categoryId === categoryId);
      // Typing the tracked amount back in is the same as clearing the override.
      const next = cents !== null && row && cents === row.trackedCents ? null : cents;
      if ((previous?.actualOverrideCents ?? null) === next) return;
      patchLine(key, categoryId, { actualOverrideCents: next });
      try {
        const id = await ensurePeriod();
        await upsertBudgetLine(supabase, {
          user_id: userId,
          budget_period_id: id,
          category_id: categoryId,
          planned_cents: previous?.plannedCents ?? 0,
          actual_override_cents: next,
        });
        setErrorMessage(null);
      } catch (error) {
        patchLine(key, categoryId, { actualOverrideCents: previous?.actualOverrideCents ?? null });
        setErrorMessage(`Couldn't save that amount. ${messageOf(error)}`);
      }
    },
    [userId, year, month, raw.linesByMonth, model.categoryRows, patchLine, ensurePeriod]
  );

  return {
    isGuest,
    isLoading: base === null,
    errorMessage,
    clearError: () => setErrorMessage(null),
    month,
    year,
    setMonth,
    setYear,
    refresh,
    today,
    model,
    savePlanned,
    saveActual,
  };
}
