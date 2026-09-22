import type {
  BillPaymentForReport,
  BillWithPayments,
  DebtPaymentForReport,
  DebtWithPayments,
  Tables,
} from '@own-my-budget/api';
import {
  buildBudgetRows,
  buildChartBars,
  buildImproveTips,
  buildInsights,
  buildSnapshotCards,
  buildTips,
  buildUpcomingBills,
  calculateCashFlow,
  calculateDebtProgress,
  calculateMonthlyHealth,
  calculateNetGoalSavings,
  calculateSavingsProgress,
  calculateVariableSpendingCents,
  classifyBill,
  countPaydaysInMonth,
  describeChange,
  describeScoreChange,
  evaluateMissions,
  formatLocalDate,
  goalBarTone,
  isDebtPaidOff,
  isEmergencyFundGoal,
  monthlySavingsGoalCents,
  monthsForRange,
  parseLocalDate,
  projectMonthIncomeCents,
  splitIncomeLabel,
  upcomingPaydays,
  type BudgetCategoryRow,
  type BudgetLineInput,
  type CashFlow,
  type ChangeNote,
  type ChartBar,
  type ChartRangeKey,
  type DebtProgress,
  type GoalBarTone,
  type MissionStatus,
  type MonthlyHealth,
  type PayoffStrategy,
  type SnapshotCard,
  type UpcomingBill,
  type CategorizedAmount,
} from '@own-my-budget/core';

import { formatMonthDay } from './format';

/** Everything the Dashboard loads, exactly as the API returns it. */
export interface RawDashboardData {
  displayName: string;
  categories: { id: string; name: string }[];
  incomeSources: Tables<'income_sources'>[];
  bills: BillWithPayments[];
  debts: DebtWithPayments[];
  goals: Tables<'savings_goals'>[];
  goalActivity: Tables<'goal_activity'>[];
  payoffStrategy: PayoffStrategy;
  assignments: Tables<'payday_assignments'>[];
  /** Dates (YYYY-MM-DD) in the last 7 days that have a transaction — feeds the "track every expense" mission. */
  recentTransactionDates: string[];
  /** A rolling window of records ending at the selected month, for the chart and month-over-month deltas. */
  transactions: Tables<'transactions'>[];
  billPayments: BillPaymentForReport[];
  debtPayments: DebtPaymentForReport[];
  /** Budget lines by 'YYYY-MM' — only the selected and previous month are loaded. */
  linesByMonth: Record<string, BudgetLineInput[]>;
}

export const EMPTY_RAW: RawDashboardData = {
  displayName: '',
  categories: [],
  incomeSources: [],
  bills: [],
  debts: [],
  goals: [],
  goalActivity: [],
  payoffStrategy: 'snowball',
  assignments: [],
  recentTransactionDates: [],
  transactions: [],
  billPayments: [],
  debtPayments: [],
  linesByMonth: {},
};

export const monthKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

export interface DashboardGoal {
  id: string;
  label: string;
  targetCents: number;
  savedCents: number;
  targetDate: string | null;
  percent: number;
  remainingCents: number;
  tone: GoalBarTone;
}

export interface DashboardPaycheck {
  dateLabel: string;
  sourceLabel: string;
  amountCents: number;
  assignedCount: number;
  remainingCents: number;
}

export interface DashboardModel {
  displayName: string;
  /** True when the account has nothing to build a picture from yet. */
  isEmpty: boolean;
  income: { cents: number; change: ChangeNote };
  billsAndPayments: { cents: number; paidCount: number; totalCount: number };
  savings: { cents: number; change: ChangeNote };
  available: { cents: number; change: ChangeNote };
  cashFlow: CashFlow;
  chartBars: (rangeKey: ChartRangeKey) => ChartBar[];
  health: MonthlyHealth;
  healthChange: { text: string; tone: 'good' | 'watch' | 'neutral' };
  improveTips: string[];
  snapshots: SnapshotCard[];
  tips: string[];
  missions: MissionStatus[];
  insights: string[];
  upcomingBills: UpcomingBill[];
  categoryRows: BudgetCategoryRow[];
  goals: DashboardGoal[];
  debtProgress: DebtProgress;
  strategy: PayoffStrategy;
  nextPaycheck: DashboardPaycheck | null;
  /** First unpaid bill — what "Record a Payment" opens. */
  firstUnpaidBillId: string | null;
  firstUnpaidBillCents: number;
  firstGoalId: string | null;
}

interface MonthFigures {
  incomeCents: number;
  rows: BudgetCategoryRow[];
  budgetActualCents: number;
  budgetPlannedCents: number;
  variableCents: number;
  savedCents: number;
  debtPaidCents: number;
  spendCents: number;
  hasActivity: boolean;
}

function inMonth(dateOnly: string, year: number, month: number): boolean {
  return dateOnly.slice(0, 7) === monthKey(year, month);
}

function figuresFor(
  raw: RawDashboardData,
  year: number,
  month: number,
  incomeCents: number
): MonthFigures {
  const validCategoryIds = new Set(raw.categories.map((c) => c.id));
  const monthBillPayments = raw.billPayments.filter((p) => inMonth(p.paid_on, year, month));
  const monthDebtPayments = raw.debtPayments.filter((p) => inMonth(p.paid_on, year, month));
  const outflow = raw.transactions.filter(
    (t) => t.amount_cents < 0 && inMonth(t.occurred_on, year, month)
  );

  const tracked: CategorizedAmount[] = [
    ...monthBillPayments.map((p) => ({ categoryId: p.category_id, amountCents: p.amount_cents })),
    ...outflow.map((t) => ({ categoryId: t.category_id, amountCents: Math.abs(t.amount_cents) })),
  ];
  const rows = buildBudgetRows(
    raw.categories,
    raw.linesByMonth[monthKey(year, month)] ?? [],
    tracked
  );

  const billPaidByCategory: Record<string, number> = {};
  for (const p of monthBillPayments) {
    if (p.category_id) {
      billPaidByCategory[p.category_id] = (billPaidByCategory[p.category_id] ?? 0) + p.amount_cents;
    }
  }
  const uncategorizedCents = outflow
    .filter((t) => !t.category_id || !validCategoryIds.has(t.category_id))
    .reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);

  const savedCents = calculateNetGoalSavings(
    raw.goalActivity
      .filter((a) => inMonth(a.occurred_on, year, month))
      .map((a) => ({ kind: a.kind, amountCents: a.amount_cents }))
  );
  const debtPaidCents = monthDebtPayments.reduce((sum, p) => sum + p.amount_cents, 0);
  const spendCents =
    monthBillPayments.reduce((sum, p) => sum + p.amount_cents, 0) +
    debtPaidCents +
    outflow.reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);

  return {
    incomeCents,
    rows,
    budgetActualCents: rows.reduce((sum, r) => sum + r.actualCents, 0),
    budgetPlannedCents: rows.reduce((sum, r) => sum + r.plannedCents, 0),
    variableCents: calculateVariableSpendingCents(rows, billPaidByCategory, uncategorizedCents),
    savedCents,
    debtPaidCents,
    spendCents,
    hasActivity: spendCents > 0 || savedCents !== 0,
  };
}

/** Next calendar date on/after `today` that falls on `dueDay` (1-31, clamped to the month's length). */
function nextDueDate(dueDay: number, today: Date): string {
  for (let offset = 0; offset < 2; offset++) {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0).getDate();
    const candidate = new Date(
      today.getFullYear(),
      today.getMonth() + offset,
      Math.min(dueDay, lastDay)
    );
    if (candidate >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return formatLocalDate(candidate);
    }
  }
  return formatLocalDate(today);
}

export function buildDashboardModel(
  raw: RawDashboardData,
  year: number,
  month: number,
  today: Date
): DashboardModel {
  const schedules = raw.incomeSources.map((s) => ({
    frequency: s.frequency,
    nextPayDate: s.next_pay_date,
    amountCents: s.amount_cents,
    isActive: s.archived_at === null,
  }));
  const prevRef = { year: month === 0 ? year - 1 : year, month: month === 0 ? 11 : month - 1 };

  const incomeCents = projectMonthIncomeCents(schedules, year, month);
  const prevIncomeCents = projectMonthIncomeCents(schedules, prevRef.year, prevRef.month);
  const current = figuresFor(raw, year, month, incomeCents);
  const previous = figuresFor(raw, prevRef.year, prevRef.month, prevIncomeCents);
  const hasPrevious = prevIncomeCents > 0 || previous.hasActivity;

  // --- bills (current state, month-independent — bills recur monthly) ---
  const categoryNames = new Map(raw.categories.map((c) => [c.id, c.name]));
  const billItems = raw.bills.map((b) => ({
    id: b.id,
    label: b.label,
    categoryName: b.category_id ? (categoryNames.get(b.category_id) ?? null) : null,
    amountCents: b.amount_cents,
    paidCents: b.bill_payments.reduce((sum, p) => sum + p.amount_cents, 0),
    dueDate: b.due_date,
    autopay: b.autopay,
  }));
  const classified = billItems.map((b) => ({ ...b, ...classifyBill(b, today) }));
  const billsTotalCents = billItems.reduce((sum, b) => sum + b.amountCents, 0);
  const billsPaidCents = billItems.reduce(
    (sum, b) => sum + Math.min(b.paidCents, b.amountCents),
    0
  );
  const billsPaidCount = classified.filter((b) => b.status === 'paid').length;
  const overdueBillsCount = classified.filter((b) => b.status === 'overdue').length;
  const billsUnpaidCents = Math.max(0, billsTotalCents - billsPaidCents);

  // --- debts ---
  const debtItems = raw.debts.map((d) => {
    const totalPaidCents = d.debt_payments.reduce((sum, p) => sum + p.amount_cents, 0);
    return {
      id: d.id,
      label: d.label,
      type: d.type,
      balanceCents: d.balance_cents,
      startingBalanceCents: d.original_balance_cents ?? d.balance_cents + totalPaidCents,
      totalPaidCents,
      aprBasisPoints: d.apr_basis_points,
      minimumPaymentCents: d.minimum_payment_cents,
      dueDay: d.due_day,
      paidOff: isDebtPaidOff({
        balanceCents: d.balance_cents,
        originalBalanceCents: d.original_balance_cents ?? null,
        totalPaidCents,
      }),
    };
  });
  const activeDebts = debtItems.filter((d) => !d.paidOff);
  const debtDueCents = activeDebts.reduce((sum, d) => sum + d.minimumPaymentCents, 0);
  const cards = debtItems.filter((d) => d.type === 'creditCard');
  const loans = debtItems.filter((d) => d.type !== 'creditCard');
  const loanDueDates = loans
    .filter((d) => !d.paidOff && d.dueDay)
    .map((d) => nextDueDate(d.dueDay as number, today))
    .sort();

  // --- goals ---
  const goalItems = raw.goals.filter((g) => !g.is_challenge);
  const savingsGoalCents = monthlySavingsGoalCents(
    goalItems.map((g) => ({
      savedCents: g.saved_cents,
      targetCents: g.target_cents,
      targetDate: g.target_date,
    })),
    today
  );
  const goals: DashboardGoal[] = goalItems
    .filter((g) => g.target_cents <= 0 || g.saved_cents < g.target_cents)
    .slice(0, 3)
    .map((g) => {
      const { percent } = calculateSavingsProgress(g.saved_cents, g.target_cents);
      return {
        id: g.id,
        label: g.label,
        targetCents: g.target_cents,
        savedCents: g.saved_cents,
        targetDate: g.target_date,
        percent: Math.round(percent),
        remainingCents: Math.max(0, g.target_cents - g.saved_cents),
        tone: goalBarTone(Math.round(percent)),
      };
    });

  // --- headline figures ---
  const cashFlow = calculateCashFlow({
    incomeCents,
    billsCents: billsTotalCents,
    debtCents: debtDueCents,
    variableCents: current.variableCents,
    savingsCents: current.savedCents,
  });
  const previousCashFlow = hasPrevious
    ? calculateCashFlow({
        incomeCents: prevIncomeCents,
        billsCents: billsTotalCents,
        debtCents: debtDueCents,
        variableCents: previous.variableCents,
        savingsCents: previous.savedCents,
      })
    : null;

  const healthInput = (figures: MonthFigures) => ({
    incomeCents: figures.incomeCents,
    budgetActualCents: figures.budgetActualCents,
    budgetPlannedCents: figures.budgetPlannedCents,
    billsCount: billItems.length,
    billsTotalCents,
    billsPaidCents,
    overdueBillsCount,
    debtDueCents,
    debtPaidCents: figures.debtPaidCents,
    savedCents: Math.max(figures.savedCents, 0),
    savingsGoalCents,
  });
  const health = calculateMonthlyHealth(healthInput(current));
  const previousHealth = hasPrevious ? calculateMonthlyHealth(healthInput(previous)) : null;

  const snapshots = buildSnapshotCards({
    billsCount: billItems.length,
    billsPaidCount,
    overdueBillsCount,
    budgetActualCents: current.budgetActualCents,
    budgetPlannedCents: current.budgetPlannedCents,
    savedCents: Math.max(current.savedCents, 0),
    savingsGoalCents,
    cardBalanceCents: cards.reduce((sum, d) => sum + d.balanceCents, 0),
    cardStartingCents: cards.reduce(
      (sum, d) => sum + Math.max(d.startingBalanceCents, d.balanceCents),
      0
    ),
    cardPaidCents: cards.reduce((sum, d) => sum + d.totalPaidCents, 0),
    loanMonthlyCents: loans
      .filter((d) => !d.paidOff)
      .reduce((sum, d) => sum + d.minimumPaymentCents, 0),
    loanBalanceCents: loans.reduce((sum, d) => sum + d.balanceCents, 0),
    loanPaidCents: loans.reduce((sum, d) => sum + d.totalPaidCents, 0),
    nextLoanDueLabel: loanDueDates[0] ? formatMonthDay(loanDueDates[0]) : null,
    availableCents: cashFlow.availableCents,
  });

  // --- tips / insights / missions ---
  const emergency = goalItems
    .filter((g) => isEmergencyFundGoal(g.label))
    .sort((a, b) => b.target_cents - a.target_cents)[0];
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
  const emergencyDeposits = emergency
    ? calculateNetGoalSavings(
        raw.goalActivity
          .filter(
            (a) =>
              a.goal_id === emergency.id &&
              parseLocalDate(a.occurred_on.slice(0, 10)) >= threeMonthsAgo
          )
          .map((a) => ({ kind: a.kind, amountCents: a.amount_cents }))
      )
    : 0;
  const paydayCounts = schedules
    .filter((s) => s.isActive)
    .map((s) => countPaydaysInMonth(s.frequency, s.nextPayDate, year, month));
  const tips = buildTips({
    categories: current.rows.map((row) => ({
      name: row.name,
      currentCents: row.actualCents,
      previousCents: previous.rows.find((r) => r.categoryId === row.categoryId)?.actualCents ?? 0,
    })),
    unpaidManualBills: classified
      .filter((b) => b.status !== 'paid' && !b.autopay)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
    emergencyFund: emergency
      ? {
          label: emergency.label,
          remainingCents: Math.max(0, emergency.target_cents - emergency.saved_cents),
          monthlyPaceCents: Math.round(emergencyDeposits / 3),
        }
      : null,
    paychecksPerMonth: Math.max(1, ...paydayCounts),
  });

  const emergencyPercent = emergency
    ? calculateSavingsProgress(emergency.saved_cents, emergency.target_cents).percent
    : null;
  const thisMonthPrefix = formatLocalDate(today).slice(0, 7);
  const missions = evaluateMissions({
    trackedDays: Math.min(new Set(raw.recentTransactionDates).size, 7),
    depositsThisMonth: raw.goalActivity.filter(
      (a) => a.kind === 'deposit' && a.occurred_on.slice(0, 7) === thisMonthPrefix
    ).length,
    emergencyPercent,
  }).slice(0, 3);

  const insights = buildInsights({
    billsCount: billItems.length,
    billsTotalCents,
    billsPaidCents,
    previousVariableCents: hasPrevious ? previous.variableCents : null,
    variableCents: current.variableCents,
    savedCents: Math.max(current.savedCents, 0),
    savingsGoalCents,
    overdueBillsCount,
    availableCents: cashFlow.availableCents,
    previousAvailableCents: previousCashFlow ? previousCashFlow.availableCents : null,
  });

  // --- next paycheck ---
  const next = upcomingPaydays(
    raw.incomeSources
      .filter((s) => s.archived_at === null)
      .map((s) => ({
        id: s.id,
        label: s.label,
        amountCents: s.amount_cents,
        frequency: s.frequency,
        nextPayDate: s.next_pay_date,
      })),
    1,
    today
  )[0];
  let nextPaycheck: DashboardPaycheck | null = null;
  if (next) {
    const assigned = raw.assignments.filter(
      (a) => a.income_source_id === next.incomeSourceId && a.pay_date === next.date
    );
    nextPaycheck = {
      dateLabel: formatMonthDay(next.date),
      sourceLabel: splitIncomeLabel(next.label).source || next.label,
      amountCents: next.amountCents,
      assignedCount: assigned.length,
      remainingCents: next.amountCents - assigned.reduce((sum, a) => sum + a.amount_cents, 0),
    };
  }

  const upcomingBills = buildUpcomingBills(billItems, today, 5);
  const firstUnpaid = classified
    .filter((b) => b.status !== 'paid')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];

  const chartBars = (rangeKey: ChartRangeKey) =>
    buildChartBars(
      monthsForRange(rangeKey, year, month).map((ref) => {
        const income = projectMonthIncomeCents(schedules, ref.year, ref.month);
        const figures = figuresFor(raw, ref.year, ref.month, income);
        return { ...ref, incomeCents: income, spendCents: figures.spendCents };
      })
    );

  return {
    displayName: raw.displayName,
    isEmpty:
      raw.incomeSources.length === 0 &&
      raw.bills.length === 0 &&
      raw.debts.length === 0 &&
      raw.goals.length === 0,
    income: {
      cents: incomeCents,
      change: describeChange(incomeCents, hasPrevious ? prevIncomeCents : null),
    },
    billsAndPayments: {
      cents: billsTotalCents + debtDueCents,
      paidCount: billsPaidCount,
      totalCount: billItems.length,
    },
    savings: {
      cents: Math.max(current.savedCents, 0),
      change: describeChange(
        Math.max(current.savedCents, 0),
        hasPrevious ? Math.max(previous.savedCents, 0) : null
      ),
    },
    available: {
      cents: cashFlow.availableCents,
      change: describeChange(
        cashFlow.availableCents,
        previousCashFlow ? previousCashFlow.availableCents : null
      ),
    },
    cashFlow,
    chartBars,
    health,
    healthChange: describeScoreChange(health.score, previousHealth ? previousHealth.score : null),
    improveTips: buildImproveTips({
      overdueBillsCount,
      budgetActualCents: current.budgetActualCents,
      budgetPlannedCents: current.budgetPlannedCents,
      savedCents: Math.max(current.savedCents, 0),
      savingsGoalCents,
      billsUnpaidCents,
    }),
    snapshots,
    tips,
    missions,
    insights,
    upcomingBills,
    categoryRows: current.rows,
    goals,
    debtProgress: calculateDebtProgress(debtItems, raw.payoffStrategy),
    strategy: raw.payoffStrategy,
    nextPaycheck,
    firstUnpaidBillId: firstUnpaid?.id ?? null,
    firstUnpaidBillCents: firstUnpaid?.remainingCents ?? 0,
    firstGoalId: goalItems[0]?.id ?? null,
  };
}
