import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignPaymentToPayday,
  findBudgetPeriod,
  getOrCreateBudgetPeriod,
  listBillPaymentsForReports,
  listBillsWithPayments,
  listCategories,
  listDebtsWithPayments,
  listIncomeSources,
  listPaychecks,
  listPaydayAssignments,
  listSavingsGoals,
  listTransactions,
  removePaydayAssignment,
  upsertBudgetLine,
  listBudgetLines,
  type PaydayTargetType,
  type Tables,
} from '@own-my-budget/api';
import {
  assignPaycheck,
  budgetBarPercents,
  buildBudgetRows,
  deriveBillStatus,
  formatLocalDate,
  generatePaydays,
  splitIncomeLabel,
  summarizeBudget,
  type BudgetBarPercents,
  type BudgetCategoryRow,
  type BudgetLineInput,
  type BudgetSummary,
  type CategorizedAmount,
  type PayFrequency,
} from '@own-my-budget/core';

import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  twice_monthly: 'Twice monthly',
  monthly: 'Monthly',
  variable: 'Variable',
};

export const TARGET_TYPE_LABEL: Record<PaydayTargetType, string> = {
  bill: 'Bill',
  debt: 'Debt payment',
  savings_goal: 'Savings goal',
};

export interface PaySchedule {
  id: string;
  label: string;
  frequency: string;
  amountCents: number;
  nextPayDate: string | null;
  /** The next projected payday on or after today, when one can be projected. */
  upcomingPayDate: string | null;
  isActive: boolean;
}

export interface PaydayItem {
  /** payday_assignments.id — what "Remove" deletes. */
  assignmentId: string;
  targetType: PaydayTargetType;
  targetId: string;
  name: string;
  typeLabel: string;
  amountCents: number;
}

export interface PaydayCardData {
  key: string;
  incomeSourceId: string;
  payDate: string;
  /** The pay schedule's source half of "Person · Source" (e.g. "Retail Job"). */
  sourceLabel: string;
  /** The person half; empty when the schedule has no person. */
  personLabel: string;
  expectedCents: number;
  assignedCents: number;
  /** Negative when the assigned payments exceed the paycheck. */
  remainingCents: number;
  isOverAssigned: boolean;
  items: PaydayItem[];
}

export interface PaymentTarget {
  type: PaydayTargetType;
  id: string;
  name: string;
  typeLabel: string;
  /** What is still owed / the minimum due — prefilled into the amount field. 0 when there is no natural amount. */
  suggestedCents: number;
}

export interface BudgetData {
  isGuest: boolean;
  isLoading: boolean;
  /** True for a signed-in user with no categories, income, or paychecks yet. */
  hasNoData: boolean;
  month: number;
  year: number;
  setPeriod: (month: number, year: number) => void;
  periodLabel: string;
  rows: BudgetCategoryRow[];
  /** Bar widths per row (same order as `rows`), from core's `budgetBarPercents`. */
  bars: BudgetBarPercents[];
  summary: BudgetSummary;
  schedules: PaySchedule[];
  paydays: PaydayCardData[];
  paychecks: Tables<'paychecks'>[];
  targets: PaymentTarget[];
  /** False when the payday_assignments table isn't there yet (migration not applied) — planning is hidden, everything else works. */
  paydayPlanningAvailable: boolean;
  errorMessage: string | null;
  clearError: () => void;
  refresh: () => void;
  savePlanned: (categoryId: string, cents: number) => Promise<void>;
  /** `null` clears a typed-in actual and goes back to the tracked amount. */
  saveActual: (categoryId: string, cents: number | null) => Promise<void>;
  assignPayment: (
    payday: { incomeSourceId: string; payDate: string },
    target: PaymentTarget,
    cents: number
  ) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
}

const PAYDAY_COUNT = 6;

function monthBounds(year: number, month: number): { start: string; end: string } {
  return {
    start: formatLocalDate(new Date(year, month, 1)),
    end: formatLocalDate(new Date(year, month + 1, 0)),
  };
}

function scheduleFrom(
  source: {
    id: string;
    label: string;
    frequency: string;
    amountCents: number;
    nextPayDate: string | null;
    isActive: boolean;
  },
  today: Date
): PaySchedule {
  const upcoming = source.isActive
    ? generatePaydays(source.frequency as PayFrequency, source.nextPayDate, 1, today)[0]
    : undefined;
  return { ...source, upcomingPayDate: upcoming ?? null };
}

/**
 * Projects the next paydays across all active schedules, soonest first, and
 * folds each one's assigned payments into a remaining amount. Money math for
 * "remaining"/"over-assigned" comes from core's `assignPaycheck`.
 */
function buildPaydayCards(
  sources: {
    id: string;
    label: string;
    frequency: string;
    amountCents: number;
    nextPayDate: string | null;
  }[],
  assignments: {
    id: string;
    incomeSourceId: string;
    payDate: string;
    targetType: PaydayTargetType;
    targetId: string;
    amountCents: number;
  }[],
  targetNames: Map<string, { name: string; typeLabel: string }>,
  today: Date
): PaydayCardData[] {
  const candidates = sources.flatMap((source) =>
    generatePaydays(source.frequency as PayFrequency, source.nextPayDate, PAYDAY_COUNT, today).map(
      (payDate) => ({ source, payDate })
    )
  );
  // Same-day paydays keep the order the schedules were added in.
  const sourceOrder = new Map(sources.map((source, index) => [source.id, index]));
  candidates.sort(
    (a, b) =>
      a.payDate.localeCompare(b.payDate) ||
      (sourceOrder.get(a.source.id) ?? 0) - (sourceOrder.get(b.source.id) ?? 0)
  );

  return candidates.slice(0, PAYDAY_COUNT).map(({ source, payDate }) => {
    const items: PaydayItem[] = assignments
      .filter((a) => a.incomeSourceId === source.id && a.payDate === payDate)
      .map((a) => {
        const info = targetNames.get(`${a.targetType}:${a.targetId}`);
        return {
          assignmentId: a.id,
          targetType: a.targetType,
          targetId: a.targetId,
          name: info?.name ?? 'Removed item',
          typeLabel: info?.typeLabel ?? TARGET_TYPE_LABEL[a.targetType],
          amountCents: a.amountCents,
        };
      });
    const result = assignPaycheck(
      source.amountCents,
      items.map((i) => ({ categoryId: i.targetId, amountCents: i.amountCents }))
    );
    return {
      key: `${source.id}|${payDate}`,
      incomeSourceId: source.id,
      payDate,
      sourceLabel: splitIncomeLabel(source.label).source,
      personLabel: splitIncomeLabel(source.label).person,
      expectedCents: source.amountCents,
      assignedCents: result.totalAllocatedCents,
      remainingCents: result.remainingCents,
      isOverAssigned: result.isOverAllocated,
      items,
    };
  });
}

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200';
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : ((error as { message?: string } | null)?.message ?? 'Something went wrong.');
}

export function useBudgetData(): BudgetData {
  const { userId, isReady, isGuest, guestDataVersion } = useDataUser();
  const today = useMemo(() => new Date(), []);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [reloadTick, setReloadTick] = useState(0);

  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [incomeSources, setIncomeSources] = useState<Tables<'income_sources'>[]>([]);
  const [paychecks, setPaychecks] = useState<Tables<'paychecks'>[]>([]);
  const [bills, setBills] = useState<
    (Tables<'bills'> & { bill_payments: { amount_cents: number }[] })[]
  >([]);
  const [debts, setDebts] = useState<
    (Tables<'debts'> & { debt_payments: { amount_cents: number }[] })[]
  >([]);
  const [goals, setGoals] = useState<Tables<'savings_goals'>[]>([]);
  const [assignments, setAssignments] = useState<Tables<'payday_assignments'>[]>([]);
  const [paydayPlanningAvailable, setPaydayPlanningAvailable] = useState(true);
  const [isBaseLoading, setIsBaseLoading] = useState(true);

  const [periodId, setPeriodId] = useState<string | null>(null);
  const [lines, setLines] = useState<BudgetLineInput[]>([]);
  const [tracked, setTracked] = useState<CategorizedAmount[]>([]);
  const [loadedMonthKey, setLoadedMonthKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(() => setReloadTick((tick) => tick + 1), []);

  // Refetch whenever the tab regains focus — e.g. after adding a category or
  // income source on a pushed screen and coming back.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Everything that isn't month-specific.
  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;
    const uid = userId;

    async function load() {
      try {
        const [c, i, p, b, d, g] = await Promise.all([
          listCategories(supabase, uid, { orderBy: 'created_at' }),
          listIncomeSources(supabase, uid, { includeArchived: true }),
          listPaychecks(supabase, uid),
          listBillsWithPayments(supabase, uid),
          listDebtsWithPayments(supabase, uid),
          listSavingsGoals(supabase, uid),
        ]);
        let a: Tables<'payday_assignments'>[] = [];
        let planningAvailable = true;
        try {
          a = await listPaydayAssignments(supabase, uid);
        } catch (error) {
          // A missing table just means the payday-planning migration hasn't
          // been applied yet — anything else is a real failure worth showing.
          if (isMissingTable(error)) planningAvailable = false;
          else if (isMounted) setErrorMessage(messageOf(error));
        }
        if (!isMounted) return;
        setCategories(c);
        setIncomeSources(i);
        setPaychecks(p);
        setBills(b);
        setDebts(d);
        setGoals(g);
        setAssignments(a);
        setPaydayPlanningAvailable(planningAvailable);
      } catch (error) {
        if (isMounted) setErrorMessage(messageOf(error));
      } finally {
        if (isMounted) setIsBaseLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [isReady, userId, reloadTick, guestDataVersion]);

  // Month-specific: the budget lines plus what was actually spent.
  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;
    const uid = userId;
    const { start, end } = monthBounds(year, month);

    async function load() {
      try {
        const [period, billPayments, transactions] = await Promise.all([
          findBudgetPeriod(supabase, uid, start),
          listBillPaymentsForReports(supabase, uid, { fromDate: start, toDate: end }),
          listTransactions(supabase, uid, { fromDate: start, toDate: end }),
        ]);
        const budgetLines = period ? await listBudgetLines(supabase, period.id) : [];
        if (!isMounted) return;
        setPeriodId(period?.id ?? null);
        setLines(
          budgetLines.map((l) => ({
            categoryId: l.category_id,
            plannedCents: l.planned_cents,
            actualOverrideCents: l.actual_override_cents,
          }))
        );
        setTracked([
          ...billPayments.map((p) => ({ categoryId: p.category_id, amountCents: p.amount_cents })),
          // Transactions are signed; only money out counts as spending.
          ...transactions
            .filter((t) => t.amount_cents < 0)
            .map((t) => ({ categoryId: t.category_id, amountCents: Math.abs(t.amount_cents) })),
        ]);
      } catch (error) {
        if (isMounted) setErrorMessage(messageOf(error));
      } finally {
        if (isMounted) setLoadedMonthKey(`${year}-${month}`);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [isReady, userId, year, month, reloadTick, guestDataVersion]);

  const realRows = useMemo(
    () =>
      buildBudgetRows(
        categories.map((c) => ({ id: c.id, name: c.name })),
        lines,
        tracked
      ),
    [categories, lines, tracked]
  );

  const realSchedules = useMemo(
    () =>
      incomeSources.map((s) =>
        scheduleFrom(
          {
            id: s.id,
            label: s.label,
            frequency: s.frequency,
            amountCents: s.amount_cents,
            nextPayDate: s.next_pay_date,
            isActive: s.archived_at === null,
          },
          today
        )
      ),
    [incomeSources, today]
  );

  const targets = useMemo<PaymentTarget[]>(() => {
    const now = new Date();
    return [
      ...bills.flatMap((b) => {
        const paid = b.bill_payments.reduce((s, p) => s + p.amount_cents, 0);
        const { status: billStatus, remainingCents } = deriveBillStatus(
          b.amount_cents,
          paid,
          b.due_date,
          now
        );
        if (billStatus === 'paid') return [];
        return [
          {
            type: 'bill' as const,
            id: b.id,
            name: b.label,
            typeLabel: TARGET_TYPE_LABEL.bill,
            suggestedCents: remainingCents,
          },
        ];
      }),
      ...debts
        .filter((d) => d.balance_cents > 0)
        .map((d) => ({
          type: 'debt' as const,
          id: d.id,
          name: d.label,
          typeLabel: TARGET_TYPE_LABEL.debt,
          suggestedCents: Math.min(d.minimum_payment_cents, d.balance_cents),
        })),
      ...goals.map((g) => ({
        type: 'savings_goal' as const,
        id: g.id,
        name: g.label,
        typeLabel: TARGET_TYPE_LABEL.savings_goal,
        suggestedCents: 0,
      })),
    ];
  }, [bills, debts, goals]);

  const realPaydays = useMemo(() => {
    const names = new Map<string, { name: string; typeLabel: string }>();
    for (const b of bills)
      names.set(`bill:${b.id}`, { name: b.label, typeLabel: TARGET_TYPE_LABEL.bill });
    for (const d of debts)
      names.set(`debt:${d.id}`, { name: d.label, typeLabel: TARGET_TYPE_LABEL.debt });
    for (const g of goals)
      names.set(`savings_goal:${g.id}`, {
        name: g.label,
        typeLabel: TARGET_TYPE_LABEL.savings_goal,
      });
    return buildPaydayCards(
      incomeSources
        .filter((s) => s.archived_at === null)
        .map((s) => ({
          id: s.id,
          label: s.label,
          frequency: s.frequency,
          amountCents: s.amount_cents,
          nextPayDate: s.next_pay_date,
        })),
      assignments.map((a) => ({
        id: a.id,
        incomeSourceId: a.income_source_id,
        payDate: a.pay_date,
        targetType: a.target_type as PaydayTargetType,
        targetId: a.target_id,
        amountCents: a.amount_cents,
      })),
      names,
      today
    );
  }, [incomeSources, assignments, bills, debts, goals, today]);

  const rows = realRows;
  const summary = useMemo(() => summarizeBudget(rows), [rows]);
  const bars = useMemo(() => budgetBarPercents(rows), [rows]);

  const ensurePeriod = useCallback(async (): Promise<string> => {
    if (!userId) throw new Error('Sign in to edit your budget.');
    if (periodId) return periodId;
    const { start, end } = monthBounds(year, month);
    const period = await getOrCreateBudgetPeriod(supabase, userId, start, end);
    setPeriodId(period.id);
    return period.id;
  }, [userId, periodId, year, month]);

  const patchLine = useCallback((categoryId: string, patch: Partial<BudgetLineInput>) => {
    setLines((current) => {
      const existing = current.find((l) => l.categoryId === categoryId);
      if (existing) {
        return current.map((l) => (l.categoryId === categoryId ? { ...l, ...patch } : l));
      }
      return [...current, { categoryId, plannedCents: 0, actualOverrideCents: null, ...patch }];
    });
  }, []);

  const savePlanned = useCallback(
    async (categoryId: string, cents: number) => {
      if (!isReady || !userId) return;
      const previous = lines.find((l) => l.categoryId === categoryId);
      if ((previous?.plannedCents ?? 0) === cents) return;
      patchLine(categoryId, { plannedCents: cents });
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
        patchLine(categoryId, { plannedCents: previous?.plannedCents ?? 0 });
        setErrorMessage(`Couldn't save that planned amount. ${messageOf(error)}`);
      }
    },
    [isReady, userId, lines, patchLine, ensurePeriod]
  );

  const saveActual = useCallback(
    async (categoryId: string, cents: number | null) => {
      if (!isReady || !userId) return;
      const row = realRows.find((r) => r.categoryId === categoryId);
      const previous = lines.find((l) => l.categoryId === categoryId);
      // Typing the tracked amount back in is the same as clearing the override.
      const next = cents !== null && row && cents === row.trackedCents ? null : cents;
      if ((previous?.actualOverrideCents ?? null) === next) return;
      patchLine(categoryId, { actualOverrideCents: next });
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
        patchLine(categoryId, { actualOverrideCents: previous?.actualOverrideCents ?? null });
        setErrorMessage(`Couldn't save that amount. ${messageOf(error)}`);
      }
    },
    [isReady, userId, realRows, lines, patchLine, ensurePeriod]
  );

  const assignPayment = useCallback(
    async (
      payday: { incomeSourceId: string; payDate: string },
      target: PaymentTarget,
      cents: number
    ) => {
      if (!isReady || !userId) return;
      try {
        const saved = await assignPaymentToPayday(supabase, {
          user_id: userId,
          income_source_id: payday.incomeSourceId,
          pay_date: payday.payDate,
          target_type: target.type,
          target_id: target.id,
          amount_cents: cents,
        });
        setAssignments((current) => [...current.filter((a) => a.id !== saved.id), saved]);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(`Couldn't assign that payment. ${messageOf(error)}`);
        throw error;
      }
    },
    [isReady, userId]
  );

  const removeAssignment = useCallback(
    async (assignmentId: string) => {
      const previous = assignments;
      setAssignments((current) => current.filter((a) => a.id !== assignmentId));
      try {
        await removePaydayAssignment(supabase, assignmentId);
        setErrorMessage(null);
      } catch (error) {
        setAssignments(previous);
        setErrorMessage(`Couldn't remove that payment. ${messageOf(error)}`);
      }
    },
    [assignments]
  );

  const setPeriod = useCallback((nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
    // Different month, different budget period.
    setPeriodId(null);
  }, []);

  const clearError = useCallback(() => setErrorMessage(null), []);

  const isLoading = !isReady || isBaseLoading || loadedMonthKey !== `${year}-${month}`;

  return {
    isGuest,
    isLoading,
    hasNoData:
      !isLoading && categories.length === 0 && incomeSources.length === 0 && paychecks.length === 0,
    month,
    year,
    setPeriod,
    periodLabel: `${MONTH_NAMES[month]} ${year}`,
    rows,
    bars,
    summary,
    schedules: realSchedules,
    paydays: realPaydays,
    paychecks,
    targets,
    paydayPlanningAvailable,
    errorMessage,
    clearError,
    refresh,
    savePlanned,
    saveActual,
    assignPayment,
    removeAssignment,
  };
}
