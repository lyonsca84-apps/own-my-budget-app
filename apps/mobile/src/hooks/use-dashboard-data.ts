import { useEffect, useMemo, useState } from 'react';
import {
  getCurrentAccount,
  listAccounts,
  listBillPaymentsForReports,
  listBillsWithPayments,
  listDebtPaymentsForReports,
  listDebtsWithPayments,
  listPaychecks,
  listSavingsGoals,
  type BillWithPayments,
  type DebtWithPayments,
  type Tables,
} from '@own-my-budget/api';
import {
  DEMO_DATA,
  calculateBudgetHealth,
  calculateCreditUtilization,
  calculateMoneyLeftToSpend,
  calculateSavingsProgress,
  deriveBillStatus,
  formatLocalDate,
  sumDebtBalances,
  sumSavingsSaved,
  type BudgetHealthResult,
  type BillStatus,
  type DemoDebt,
  type DemoSavingsGoal,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

export interface DashboardBill {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string;
  status: BillStatus;
}

export interface DashboardCashFlow {
  month: number; // 0-11
  year: number;
  incomeCents: number;
  spendingCents: number;
}

export interface DashboardData {
  displayName: string;
  balanceCents: number;
  unpaidBillsCents: number;
  savingsTotalCents: number;
  debtTotalCents: number;
  moneyLeftToSpendCents: number;
  billsPaidCount: number;
  billsTotalCount: number;
  nextPaycheck: { label: string; amountCents: number; payDate: string } | null;
  billsNeedingAttention: DashboardBill[];
  budgetHealth: BudgetHealthResult;
  cashFlow: DashboardCashFlow;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  refresh: () => void;
  /** True only for a real signed-in user who hasn't added anything yet — distinct from guest, which always has demo data. */
  hasNoData: boolean;
  isLoading: boolean;
}

const BILL_STATUS_PRIORITY: Record<BillStatus, number> = { overdue: 0, upcoming: 1, paid: 2 };

function billFromReal(bill: BillWithPayments, today: Date): DashboardBill {
  const paidCents = bill.bill_payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const { status } = deriveBillStatus(bill.amount_cents, paidCents, bill.due_date, today);
  return {
    id: bill.id,
    label: bill.label,
    amountCents: bill.amount_cents,
    dueDate: bill.due_date,
    status,
  };
}

/** Average credit-card utilization across revolving debts only — `null` when there are none to measure. */
function averageCreditUtilization(
  debts: { type: string; balance_cents: number; credit_limit_cents: number | null }[]
): number | null {
  const cards = debts.filter((d) => d.type === 'creditCard' && d.credit_limit_cents);
  if (cards.length === 0) return null;
  const total = cards.reduce(
    (sum, d) => sum + calculateCreditUtilization(d.balance_cents, d.credit_limit_cents!),
    0
  );
  return total / cards.length;
}

function averageCreditUtilizationDemo(debts: DemoDebt[]): number | null {
  const cards = debts.filter((d) => d.type === 'creditCard' && d.creditLimitCents);
  if (cards.length === 0) return null;
  const total = cards.reduce(
    (sum, d) => sum + calculateCreditUtilization(d.balanceCents, d.creditLimitCents!),
    0
  );
  return total / cards.length;
}

/** Average progress across active savings goals — `null` when there are none yet. */
function averageSavingsProgress(
  goals: { saved_cents: number; target_cents: number }[]
): number | null {
  if (goals.length === 0) return null;
  const total = goals.reduce(
    (sum, g) => sum + calculateSavingsProgress(g.saved_cents, g.target_cents).percent,
    0
  );
  return total / goals.length;
}

function averageSavingsProgressDemo(goals: DemoSavingsGoal[]): number | null {
  if (goals.length === 0) return null;
  const total = goals.reduce(
    (sum, g) => sum + calculateSavingsProgress(g.savedCents, g.targetCents).percent,
    0
  );
  return total / goals.length;
}

function monthRange(year: number, month: number): { fromDate: string; toDate: string } {
  return {
    fromDate: formatLocalDate(new Date(year, month, 1)),
    toDate: formatLocalDate(new Date(year, month + 1, 0)),
  };
}

const EMPTY_CASH_FLOW = (month: number, year: number): DashboardCashFlow => ({
  month,
  year,
  incomeCents: 0,
  spendingCents: 0,
});

function buildGuestData(month: number, year: number): DashboardData {
  const { profile, account, incomeSources, bills, debts, savingsGoals } = DEMO_DATA;
  // Demo bills are a fixed, hand-authored snapshot (see demoData.ts) — their
  // `status` is already correct for the scenario, no need to re-derive it
  // from today's date the way real bills are.
  const derivedBills: DashboardBill[] = bills.map((b) => ({
    id: b.id,
    label: b.label,
    amountCents: b.amountCents,
    dueDate: b.dueDate,
    status: b.status,
  }));
  const unpaidBillsCents = derivedBills
    .filter((b) => b.status !== 'paid')
    .reduce((sum, b) => sum + b.amountCents, 0);
  const nextPaycheck = incomeSources[0]
    ? {
        label: incomeSources[0].label,
        amountCents: incomeSources[0].amountCents,
        payDate: incomeSources[0].nextPayDate,
      }
    : null;
  const debtTotalCents = sumDebtBalances(DEMO_DATA);
  const savingsTotalCents = sumSavingsSaved(DEMO_DATA);
  const moneyLeftToSpendCents = calculateMoneyLeftToSpend({
    balanceCents: account.balanceCents,
    unpaidBillsCents,
  }).totalCents;
  const demoIncomeCents = incomeSources.reduce((sum, s) => sum + s.amountCents, 0);

  return {
    displayName: profile.displayName,
    balanceCents: account.balanceCents,
    unpaidBillsCents,
    savingsTotalCents,
    debtTotalCents,
    moneyLeftToSpendCents,
    billsPaidCount: derivedBills.filter((b) => b.status === 'paid').length,
    billsTotalCount: derivedBills.length,
    nextPaycheck,
    billsNeedingAttention: derivedBills
      .filter((b) => b.status !== 'paid')
      .sort((a, b) => BILL_STATUS_PRIORITY[a.status] - BILL_STATUS_PRIORITY[b.status])
      .slice(0, 4),
    budgetHealth: calculateBudgetHealth({
      balanceCents: account.balanceCents,
      moneyLeftToSpendCents,
      overdueBillsCount: derivedBills.filter((b) => b.status === 'overdue').length,
      totalBillsCount: derivedBills.length,
      debtTotalCents,
      savingsTotalCents,
      averageCreditUtilizationPercent: averageCreditUtilizationDemo(debts),
      averageSavingsGoalPercent: averageSavingsProgressDemo(savingsGoals),
    }),
    cashFlow: { month, year, incomeCents: demoIncomeCents, spendingCents: unpaidBillsCents },
    selectedMonth: month,
    selectedYear: year,
    setSelectedMonth: () => {},
    setSelectedYear: () => {},
    refresh: () => {},
    hasNoData: false,
    isLoading: false,
  };
}

const LOADING_HEALTH: BudgetHealthResult = {
  score: 0,
  tone: 'watch',
  label: 'Loading…',
  summary: '',
};

export function useDashboardData(): DashboardData {
  const { status, user } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [realData, setRealData] = useState<Omit<
    DashboardData,
    | 'cashFlow'
    | 'selectedMonth'
    | 'selectedYear'
    | 'setSelectedMonth'
    | 'setSelectedYear'
    | 'refresh'
  > | null>(null);
  const [cashFlow, setCashFlow] = useState<DashboardCashFlow>(
    EMPTY_CASH_FLOW(selectedMonth, selectedYear)
  );
  const [paychecksForIncome, setPaychecksForIncome] = useState<Tables<'paychecks'>[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    let isMounted = true;

    async function load() {
      const now = new Date();
      const [account, accounts, bills, paychecks, debts, goals] = await Promise.all([
        getCurrentAccount(supabase, user!.id),
        listAccounts(supabase, user!.id),
        listBillsWithPayments(supabase, user!.id),
        listPaychecks(supabase, user!.id),
        listDebtsWithPayments(supabase, user!.id),
        listSavingsGoals(supabase, user!.id),
      ]);
      if (!isMounted) return;

      const balanceCents = accounts.reduce((sum, a) => sum + a.balance_cents, 0);
      const derivedBills = bills.map((b) => billFromReal(b, now));
      const unpaidBillsCents = derivedBills
        .filter((b) => b.status !== 'paid')
        .reduce((sum, b) => sum + b.amountCents, 0);
      const latestPaycheck = paychecks[0];
      const debtTotalCents = sumDebtTotals(debts);
      const savingsTotalCents = sumSavingsTotals(goals);
      const moneyLeftToSpendCents = calculateMoneyLeftToSpend({
        balanceCents,
        unpaidBillsCents,
      }).totalCents;

      setPaychecksForIncome(paychecks);
      setRealData({
        displayName: account.profile.display_name?.trim() || 'there',
        balanceCents,
        unpaidBillsCents,
        savingsTotalCents,
        debtTotalCents,
        moneyLeftToSpendCents,
        billsPaidCount: derivedBills.filter((b) => b.status === 'paid').length,
        billsTotalCount: derivedBills.length,
        nextPaycheck: latestPaycheck
          ? {
              label: 'Paycheck',
              amountCents: latestPaycheck.amount_cents,
              payDate: latestPaycheck.pay_date,
            }
          : null,
        billsNeedingAttention: derivedBills
          .filter((b) => b.status !== 'paid')
          .sort((a, b) => BILL_STATUS_PRIORITY[a.status] - BILL_STATUS_PRIORITY[b.status])
          .slice(0, 4),
        budgetHealth: calculateBudgetHealth({
          balanceCents,
          moneyLeftToSpendCents,
          overdueBillsCount: derivedBills.filter((b) => b.status === 'overdue').length,
          totalBillsCount: derivedBills.length,
          debtTotalCents,
          savingsTotalCents,
          averageCreditUtilizationPercent: averageCreditUtilization(debts),
          averageSavingsGoalPercent: averageSavingsProgress(goals),
        }),
        hasNoData:
          accounts.length === 0 &&
          bills.length === 0 &&
          paychecks.length === 0 &&
          debts.length === 0 &&
          goals.length === 0,
        isLoading: false,
      });
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [status, user, reloadTick]);

  // Spending-this-month comes from a targeted, date-ranged query (the base
  // load above only fetches lifetime payment totals per bill/debt) — kept in
  // its own effect so switching months doesn't re-fetch everything else.
  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    let isMounted = true;
    const range = monthRange(selectedYear, selectedMonth);

    async function loadCashFlow() {
      const [billPayments, debtPayments] = await Promise.all([
        listBillPaymentsForReports(supabase, user!.id, range),
        listDebtPaymentsForReports(supabase, user!.id, range),
      ]);
      if (!isMounted) return;
      const spendingCents =
        billPayments.reduce((sum, p) => sum + p.amount_cents, 0) +
        debtPayments.reduce((sum, p) => sum + p.amount_cents, 0);
      const incomeCents = paychecksForIncome
        .filter((p) => p.pay_date >= range.fromDate && p.pay_date <= range.toDate)
        .reduce((sum, p) => sum + p.amount_cents, 0);
      setCashFlow({ month: selectedMonth, year: selectedYear, incomeCents, spendingCents });
    }

    loadCashFlow();
    return () => {
      isMounted = false;
    };
  }, [status, user, selectedMonth, selectedYear, paychecksForIncome]);

  const guestData = useMemo(
    () => buildGuestData(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  );

  if (status === 'guest') return guestData;

  if (status === 'signedIn') {
    return {
      ...(realData ?? {
        displayName: '',
        balanceCents: 0,
        unpaidBillsCents: 0,
        savingsTotalCents: 0,
        debtTotalCents: 0,
        moneyLeftToSpendCents: 0,
        billsPaidCount: 0,
        billsTotalCount: 0,
        nextPaycheck: null,
        billsNeedingAttention: [],
        budgetHealth: LOADING_HEALTH,
        hasNoData: false,
        isLoading: true,
      }),
      cashFlow,
      selectedMonth,
      selectedYear,
      setSelectedMonth,
      setSelectedYear,
      refresh: () => setReloadTick((n) => n + 1),
    };
  }

  // loading/signedOut/passwordRecovery never render this screen, but keep the hook total.
  return guestData;
}

function sumDebtTotals(debts: DebtWithPayments[]): number {
  return debts.reduce((sum, d) => sum + d.balance_cents, 0);
}

function sumSavingsTotals(goals: Tables<'savings_goals'>[]): number {
  return goals.reduce((sum, g) => sum + g.saved_cents, 0);
}
