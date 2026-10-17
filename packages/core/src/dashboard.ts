import { formatCents } from './money';
import { deriveBillStatus } from './budgeting';
import { calculateDebtPaidPercent, orderDebtsForStrategy, type PayoffStrategy } from './debt';
import { parseLocalDate } from './dates';
import { suggestedContributionCents } from './savings';

/**
 * Dashboard math — everything the Dashboard page shows that isn't already a
 * budgeting/debt/savings primitive: projected income for a month,
 * month-over-month deltas, the cash-flow split, the six-factor Budget Health
 * Score, the snapshot cards, tips and insights. Pure and deterministic; the
 * caller passes `today` and already-loaded numbers (integer cents).
 *
 * Tone rule carried through every helper: overspending and "needs a look"
 * are a calm `watch` state; only genuinely overdue things are `danger`
 * (rendered clay, never bright red).
 */

// ---------------------------------------------------------------------------
// Projected income
// ---------------------------------------------------------------------------

export interface PayScheduleInput {
  /** weekly | biweekly | twice_monthly | monthly | variable */
  frequency: string;
  /** income_sources.next_pay_date — a known pay date (may be in the past). */
  nextPayDate: string | null;
  amountCents: number;
  isActive?: boolean;
}

function dayNumber(year: number, monthIndex: number, day: number): number {
  return Math.floor(Date.UTC(year, monthIndex, day) / 86_400_000);
}

/**
 * How many paydays a schedule has inside one calendar month (`month` is
 * 0-based). Weekly and biweekly schedules are rolled forward *or back* from
 * their anchor date, so past and future months both work.
 */
export function countPaydaysInMonth(
  frequency: string,
  anchorDate: string | null,
  year: number,
  month: number
): number {
  if (frequency === 'monthly') return 1;
  if (frequency === 'twice_monthly') return 2;
  if (!anchorDate) return 0;
  const anchor = parseLocalDate(anchorDate);

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const step = frequency === 'weekly' ? 7 : 14;
    const anchorN = dayNumber(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const firstN = dayNumber(year, month, 1);
    const lastN = dayNumber(year, month + 1, 0);
    return Math.floor((lastN - anchorN) / step) - Math.floor((firstN - 1 - anchorN) / step);
  }

  // 'variable' — only its one stated date.
  return anchor.getFullYear() === year && anchor.getMonth() === month ? 1 : 0;
}

/** Take-home pay expected from every active pay schedule in a month. */
export function projectMonthIncomeCents(
  schedules: PayScheduleInput[],
  year: number,
  month: number
): number {
  return schedules.reduce((sum, s) => {
    if (s.isActive === false) return sum;
    return sum + countPaydaysInMonth(s.frequency, s.nextPayDate, year, month) * s.amountCents;
  }, 0);
}

// ---------------------------------------------------------------------------
// Month-over-month deltas
// ---------------------------------------------------------------------------

export interface ChangeNote {
  text: string;
  /** `good` = success green, `watch` = calm amber (never red), `neutral` = gray. */
  tone: 'good' | 'watch' | 'neutral';
}

/**
 * "$1,250.00 less than last month". `previousCents` is `null` when there is
 * nothing to compare against. `moreIsGood` picks which direction reads as
 * healthy — the other direction is a calm amber "watch", not an alarm.
 */
export function describeChange(
  currentCents: number,
  previousCents: number | null,
  moreIsGood = true
): ChangeNote {
  if (previousCents === null) return { text: 'No previous month to compare', tone: 'neutral' };
  const delta = currentCents - previousCents;
  if (delta === 0) return { text: 'Same as last month', tone: 'neutral' };
  const good = moreIsGood ? delta > 0 : delta < 0;
  return {
    text: `${formatCents(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} than last month`,
    tone: good ? 'good' : 'watch',
  };
}

// ---------------------------------------------------------------------------
// Monthly cash flow
// ---------------------------------------------------------------------------

export type CashFlowKey = 'bills' | 'debt' | 'variable' | 'savings' | 'available';

export interface CashFlowInput {
  incomeCents: number;
  /** Everything due this month across bills. */
  billsCents: number;
  /** Minimum payments across cards and loans. */
  debtCents: number;
  /** Day-to-day spending that is not a bill payment. */
  variableCents: number;
  /** Net goal deposits this month (negative counts as zero). */
  savingsCents: number;
}

export interface CashFlowSegment {
  key: CashFlowKey;
  label: string;
  cents: number;
  /** Share of the bar, 0–100 (unrounded). */
  percent: number;
}

export interface CashFlow extends CashFlowInput {
  /** Income minus everything else — can be negative (a calm "watch", not an error). */
  availableCents: number;
  segments: CashFlowSegment[];
}

export function calculateCashFlow(input: CashFlowInput): CashFlow {
  const savingsCents = Math.max(input.savingsCents, 0);
  const availableCents =
    input.incomeCents - input.billsCents - input.debtCents - input.variableCents - savingsCents;
  const parts: { key: CashFlowKey; label: string; cents: number }[] = [
    { key: 'bills', label: 'Bills', cents: input.billsCents },
    { key: 'debt', label: 'Debt payments', cents: input.debtCents },
    { key: 'variable', label: 'Groceries & variable', cents: input.variableCents },
    { key: 'savings', label: 'Savings', cents: savingsCents },
    { key: 'available', label: 'Available', cents: Math.max(availableCents, 0) },
  ];
  const total = parts.reduce((sum, p) => sum + p.cents, 0);
  return {
    ...input,
    savingsCents,
    availableCents,
    segments: parts.map((p) => ({ ...p, percent: total > 0 ? (p.cents / total) * 100 : 0 })),
  };
}

/**
 * Non-bill spending for a month: for each budget category, the actual amount
 * minus what bill payments already contributed to it (so a paid Rent isn't
 * counted once as a bill and again as "variable"), plus outflow transactions
 * that have no category at all.
 */
export function calculateVariableSpendingCents(
  rows: { categoryId: string; actualCents: number }[],
  billPaidByCategory: Record<string, number>,
  uncategorizedCents = 0
): number {
  return (
    rows.reduce(
      (sum, r) => sum + Math.max(r.actualCents - (billPaidByCategory[r.categoryId] ?? 0), 0),
      0
    ) + Math.max(uncategorizedCents, 0)
  );
}

// ---------------------------------------------------------------------------
// Income vs spending chart
// ---------------------------------------------------------------------------

export type ChartRangeKey = 'month' | 'quarter' | 'half' | 'year';

export const CHART_RANGES: { key: ChartRangeKey; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last 3 Months' },
  { key: 'half', label: 'Last 6 Months' },
  { key: 'year', label: 'This Year' },
];

export interface MonthRef {
  year: number;
  /** 0-based */
  month: number;
}

/**
 * The months a chart range covers, oldest first, ending at the selected
 * month. "This Year" runs January through the selected month.
 */
export function monthsForRange(range: ChartRangeKey, year: number, month: number): MonthRef[] {
  const count = range === 'month' ? 1 : range === 'quarter' ? 3 : range === 'half' ? 6 : month + 1;
  const months: MonthRef[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const index = year * 12 + month - back;
    months.push({ year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 });
  }
  return months;
}

export interface ChartPoint extends MonthRef {
  incomeCents: number;
  spendCents: number;
}

export interface ChartBar extends ChartPoint {
  /** Bar heights as 0–100 percent of the tallest bar in the chart. */
  incomePercent: number;
  spendPercent: number;
}

export function buildChartBars(points: ChartPoint[]): ChartBar[] {
  const max = Math.max(1, ...points.flatMap((p) => [p.incomeCents, p.spendCents]));
  return points.map((p) => ({
    ...p,
    incomePercent: Math.round((Math.max(p.incomeCents, 0) / max) * 100),
    spendPercent: Math.round((Math.max(p.spendCents, 0) / max) * 100),
  }));
}

// ---------------------------------------------------------------------------
// Budget Health Score (six equally weighted factors)
// ---------------------------------------------------------------------------

export interface MonthlyHealthInput {
  incomeCents: number;
  /** What categories show as spent this month (the Budget page's total). */
  budgetActualCents: number;
  budgetPlannedCents: number;
  billsCount: number;
  billsTotalCents: number;
  billsPaidCents: number;
  overdueBillsCount: number;
  debtDueCents: number;
  /** Debt payments made this month. */
  debtPaidCents: number;
  savedCents: number;
  /** What goals ask for per month. 0 when none. */
  savingsGoalCents: number;
}

export type HealthBand =
  'excellent' | 'doingWell' | 'makingProgress' | 'gettingStarted' | 'needsAttention';

export interface MonthlyHealth {
  /** 0–100 */
  score: number;
  band: HealthBand;
  label: string;
  note: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const HEALTH_BANDS: { min: number; band: HealthBand; label: string; note: string }[] = [
  {
    min: 85,
    band: 'excellent',
    label: 'Excellent',
    note: "You're managing this month very well.",
  },
  {
    min: 70,
    band: 'doingWell',
    label: 'Doing Well',
    note: "You're making good progress this month.",
  },
  {
    min: 50,
    band: 'makingProgress',
    label: 'Making Progress',
    note: 'A few areas still need attention this month.',
  },
  {
    min: 30,
    band: 'gettingStarted',
    label: 'Getting Started',
    note: 'Small steps will move this score up quickly.',
  },
  {
    min: 0,
    band: 'needsAttention',
    label: 'Needs Attention',
    note: 'Focus on overdue bills and overspending first.',
  },
];

/**
 * Bills paid, spending against plan, savings progress, debt payment
 * progress, income remaining, and no overdue bills — each 0–1, averaged.
 * An educational estimate, never a credit score.
 */
export function calculateMonthlyHealth(input: MonthlyHealthInput): MonthlyHealth {
  const bills =
    input.billsCount > 0 ? clamp01(input.billsPaidCents / Math.max(1, input.billsTotalCents)) : 1;
  const spending =
    input.budgetPlannedCents > 0
      ? clamp01(input.budgetPlannedCents / Math.max(input.budgetActualCents, 1))
      : 1;
  const savings =
    input.savingsGoalCents > 0
      ? clamp01(input.savedCents / input.savingsGoalCents)
      : input.savedCents > 0
        ? 1
        : 0.5;
  const debt =
    input.debtDueCents > 0 ? clamp01(input.debtPaidCents / Math.max(input.debtDueCents, 1)) : 1;
  const unpaidBills = Math.max(0, input.billsTotalCents - input.billsPaidCents);
  const remaining =
    input.incomeCents > 0
      ? clamp01((input.incomeCents - input.budgetActualCents - unpaidBills) / input.incomeCents)
      : 0;
  const overdue = input.overdueBillsCount > 0 ? 0 : 1;

  const parts = [bills, spending, savings, debt, remaining, overdue];
  const score = Math.max(
    0,
    Math.min(100, Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100))
  );
  const band = HEALTH_BANDS.find((b) => score >= b.min) ?? HEALTH_BANDS[HEALTH_BANDS.length - 1];
  return { score, band: band.band, label: band.label, note: band.note };
}

export function describeScoreChange(
  score: number,
  previousScore: number | null
): { text: string; tone: 'good' | 'watch' | 'neutral' } {
  if (previousScore === null) return { text: 'No previous month to compare', tone: 'neutral' };
  if (score === previousScore) return { text: 'Unchanged from last month', tone: 'neutral' };
  const diff = Math.abs(score - previousScore);
  return {
    text: `${score > previousScore ? 'Up' : 'Down'} ${diff} point${diff === 1 ? '' : 's'} from last month`,
    tone: score > previousScore ? 'good' : 'watch',
  };
}

/** Up to three concrete things that would lift the score, most impactful first. */
export function buildImproveTips(input: {
  overdueBillsCount: number;
  budgetActualCents: number;
  budgetPlannedCents: number;
  savedCents: number;
  savingsGoalCents: number;
  billsUnpaidCents: number;
}): string[] {
  const tips: string[] = [];
  if (input.overdueBillsCount > 0) {
    tips.push(
      `Clear ${input.overdueBillsCount} overdue bill${input.overdueBillsCount > 1 ? 's' : ''} to lift your score fastest.`
    );
  }
  if (input.budgetPlannedCents > 0 && input.budgetActualCents > input.budgetPlannedCents) {
    tips.push(
      `Spending is ${formatCents(input.budgetActualCents - input.budgetPlannedCents)} over plan — trimming one category helps.`
    );
  }
  if (input.savingsGoalCents > 0 && input.savedCents < input.savingsGoalCents) {
    tips.push(
      `Adding ${formatCents(input.savingsGoalCents - input.savedCents)} to savings reaches this month's goal.`
    );
  }
  if (input.billsUnpaidCents > 0) {
    tips.push(`${formatCents(input.billsUnpaidCents)} of bills is still unpaid this month.`);
  }
  if (tips.length === 0) {
    tips.push('Everything tracked is on plan this month — keep recording payments as they happen.');
  }
  return tips.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Snapshot cards
// ---------------------------------------------------------------------------

export type SnapshotTone = 'success' | 'warning' | 'danger' | 'accent';

export interface SnapshotCard {
  key: 'bills' | 'budget' | 'savings' | 'cards' | 'loans' | 'safe';
  title: string;
  value: string;
  lines: string[];
  badge: string;
  tone: SnapshotTone;
}

export interface SnapshotInput {
  billsCount: number;
  billsPaidCount: number;
  overdueBillsCount: number;
  budgetActualCents: number;
  budgetPlannedCents: number;
  savedCents: number;
  savingsGoalCents: number;
  cardBalanceCents: number;
  cardStartingCents: number;
  cardPaidCents: number;
  loanMonthlyCents: number;
  loanBalanceCents: number;
  loanPaidCents: number;
  /** Already-formatted next loan due date, or null. */
  nextLoanDueLabel: string | null;
  availableCents: number;
}

export function buildSnapshotCards(input: SnapshotInput): SnapshotCard[] {
  const {
    billsCount,
    billsPaidCount,
    overdueBillsCount,
    budgetActualCents: used,
    budgetPlannedCents: planned,
  } = input;

  const billsBadge: Pick<SnapshotCard, 'badge' | 'tone'> =
    billsCount > 0 && billsPaidCount === billsCount
      ? { badge: 'Paid', tone: 'success' }
      : overdueBillsCount > 0
        ? { badge: 'Needs Attention', tone: 'danger' }
        : { badge: 'On Track', tone: 'accent' };

  const budgetBadge: Pick<SnapshotCard, 'badge' | 'tone'> =
    planned > 0 && used > planned
      ? { badge: 'Over Budget', tone: 'warning' }
      : planned > 0 && used / planned > 0.85
        ? { badge: 'Nearly Complete', tone: 'warning' }
        : { badge: 'On Track', tone: 'accent' };

  const savingsBadge: Pick<SnapshotCard, 'badge' | 'tone'> =
    input.savingsGoalCents > 0 && input.savedCents >= input.savingsGoalCents
      ? { badge: 'Paid', tone: 'success' }
      : input.savedCents > 0
        ? { badge: 'On Track', tone: 'accent' }
        : { badge: 'Needs Attention', tone: 'warning' };

  const cardsBadge: Pick<SnapshotCard, 'badge' | 'tone'> =
    input.cardBalanceCents <= 0
      ? { badge: 'Paid', tone: 'success' }
      : input.cardBalanceCents < input.cardStartingCents
        ? { badge: 'On Track', tone: 'accent' }
        : { badge: 'Needs Attention', tone: 'warning' };

  const loansBadge: Pick<SnapshotCard, 'badge' | 'tone'> =
    input.loanBalanceCents <= 0 && input.loanMonthlyCents <= 0
      ? { badge: 'Paid', tone: 'success' }
      : { badge: 'On Track', tone: 'accent' };

  const safeBadge: Pick<SnapshotCard, 'badge' | 'tone'> =
    input.availableCents < 0
      ? { badge: 'Needs Attention', tone: 'warning' }
      : input.availableCents < 10_000
        ? { badge: 'Nearly Complete', tone: 'warning' }
        : { badge: 'On Track', tone: 'accent' };

  return [
    {
      key: 'bills',
      title: 'Bills Paid',
      value: billsCount > 0 ? `${Math.round((billsPaidCount / billsCount) * 100)}%` : '—',
      lines: [`${billsPaidCount} paid`, `${Math.max(0, billsCount - billsPaidCount)} remaining`],
      ...billsBadge,
    },
    {
      key: 'budget',
      title: 'Budget Used',
      value: planned > 0 ? `${Math.round((used / planned) * 100)}%` : '—',
      lines: [`${formatCents(used)} used`, `${formatCents(Math.max(0, planned - used))} remaining`],
      ...budgetBadge,
    },
    {
      key: 'savings',
      title: 'Savings Progress',
      value:
        input.savingsGoalCents > 0
          ? `${Math.round((input.savedCents / input.savingsGoalCents) * 100)}%`
          : '—',
      lines: [
        `${formatCents(input.savedCents)} saved`,
        `${formatCents(input.savingsGoalCents)} monthly goal`,
      ],
      ...savingsBadge,
    },
    {
      key: 'cards',
      title: 'Credit Card Debt',
      value: formatCents(input.cardBalanceCents),
      lines: [
        `${formatCents(input.cardPaidCents)} paid so far`,
        `${formatCents(Math.max(0, input.cardStartingCents - input.cardBalanceCents))} down from starting balance`,
      ],
      ...cardsBadge,
    },
    {
      key: 'loans',
      title: 'Loans and Mortgage',
      value: formatCents(input.loanMonthlyCents),
      lines: [
        `${formatCents(input.loanPaidCents)} paid`,
        `Next due ${input.nextLoanDueLabel ?? 'not set'}`,
      ],
      ...loansBadge,
    },
    {
      key: 'safe',
      title: 'Safe-to-Spend',
      value: formatCents(Math.max(0, input.availableCents)),
      lines: [
        'After planned bills, debt, spending and savings',
        input.availableCents > 0
          ? 'Spending this is unlikely to affect your plan'
          : 'Spending more now may stretch your plan',
      ],
      ...safeBadge,
    },
  ];
}

// ---------------------------------------------------------------------------
// Upcoming bills
// ---------------------------------------------------------------------------

export type UpcomingBillStatus = 'paid' | 'overdue' | 'partial' | 'due';

export interface UpcomingBillInput {
  id: string;
  label: string;
  categoryName: string | null;
  amountCents: number;
  paidCents: number;
  dueDate: string;
}

export interface UpcomingBill {
  id: string;
  label: string;
  category: string;
  dueDate: string;
  /** What is still owed (0 once paid). */
  amountDueCents: number;
  status: UpcomingBillStatus;
  statusLabel: string;
}

export const BILL_STATUS_LABEL: Record<UpcomingBillStatus, string> = {
  paid: 'Paid',
  overdue: 'Past Due',
  partial: 'Partially Paid',
  due: 'Upcoming',
};

export function classifyBill(
  bill: Pick<UpcomingBillInput, 'amountCents' | 'paidCents' | 'dueDate'>,
  today: Date
): { status: UpcomingBillStatus; remainingCents: number } {
  const { status, remainingCents } = deriveBillStatus(
    bill.amountCents,
    bill.paidCents,
    bill.dueDate,
    today
  );
  if (status === 'paid') return { status: 'paid', remainingCents };
  if (status === 'overdue') return { status: 'overdue', remainingCents };
  return { status: bill.paidCents > 0 ? 'partial' : 'due', remainingCents };
}

/** Unpaid bills first (soonest due on top, overdue naturally leading), paid ones last. */
export function buildUpcomingBills(
  bills: UpcomingBillInput[],
  today: Date,
  limit = 5
): UpcomingBill[] {
  return bills
    .map((b) => {
      const { status, remainingCents } = classifyBill(b, today);
      return {
        id: b.id,
        label: b.label,
        category: b.categoryName ?? 'Bill',
        dueDate: b.dueDate,
        amountDueCents: status === 'paid' ? 0 : remainingCents,
        status,
        statusLabel: BILL_STATUS_LABEL[status],
      };
    })
    .sort((a, b) => {
      const paidDiff = Number(a.status === 'paid') - Number(b.status === 'paid');
      if (paidDiff !== 0) return paidDiff;
      return a.dueDate < b.dueDate
        ? -1
        : a.dueDate > b.dueDate
          ? 1
          : a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

export interface DashboardGoalInput {
  savedCents: number;
  targetCents: number;
  targetDate: string | null;
}

/** What the goals ask for this month, summed — each goal's remaining amount spread to its target date. */
export function monthlySavingsGoalCents(goals: DashboardGoalInput[], today: Date): number {
  return goals.reduce((sum, g) => {
    if (g.targetCents <= 0 || g.savedCents >= g.targetCents) return sum;
    return (
      sum +
      (suggestedContributionCents(g.targetCents - g.savedCents, g.targetDate, 'monthly', today) ??
        0)
    );
  }, 0);
}

export type GoalBarTone = 'primary' | 'accent' | 'energy' | 'success';

/** The progress-bar color steps up as a goal nears the finish. */
export function goalBarTone(percent: number): GoalBarTone {
  if (percent >= 90) return 'success';
  if (percent >= 60) return 'energy';
  if (percent >= 30) return 'accent';
  return 'primary';
}

// ---------------------------------------------------------------------------
// Debt payoff progress
// ---------------------------------------------------------------------------

export interface DebtProgressInput {
  id: string;
  label: string;
  balanceCents: number;
  /** Balance when tracking began (original balance, or balance + everything paid). */
  startingBalanceCents: number;
  totalPaidCents: number;
  aprBasisPoints: number;
  minimumPaymentCents: number;
}

export interface DebtProgress {
  totalBalanceCents: number;
  startingBalanceCents: number;
  paidCents: number;
  /** Starting balance minus today's — never negative. */
  reducedCents: number;
  /** 0–100, of the starting debt cleared. */
  percentCleared: number;
  /** The debt the chosen strategy attacks next; null with nothing outstanding. */
  nextFocusLabel: string | null;
}

export function calculateDebtProgress(
  debts: DebtProgressInput[],
  strategy: PayoffStrategy
): DebtProgress {
  const totalBalanceCents = debts.reduce((s, d) => s + d.balanceCents, 0);
  const startingBalanceCents = debts.reduce(
    (s, d) => s + Math.max(d.startingBalanceCents, d.balanceCents),
    0
  );
  const paidCents = debts.reduce((s, d) => s + d.totalPaidCents, 0);
  const reducedCents = Math.max(0, startingBalanceCents - totalBalanceCents);
  const outstanding = debts.filter((d) => d.balanceCents > 0);
  const ordered = orderDebtsForStrategy(
    outstanding.map((d) => ({
      id: d.id,
      balanceCents: d.balanceCents,
      aprBasisPoints: d.aprBasisPoints,
      minimumPaymentCents: d.minimumPaymentCents,
    })),
    strategy
  );
  const next = ordered[0] ? debts.find((d) => d.id === ordered[0].id) : undefined;
  return {
    totalBalanceCents,
    startingBalanceCents,
    paidCents,
    reducedCents,
    percentCleared: calculateDebtPaidPercent(startingBalanceCents, totalBalanceCents) ?? 0,
    nextFocusLabel: next?.label ?? null,
  };
}

// ---------------------------------------------------------------------------
// Insights and tips
// ---------------------------------------------------------------------------

export function buildInsights(input: {
  billsCount: number;
  billsTotalCents: number;
  billsPaidCents: number;
  /** null when last month has no data to compare against. */
  previousVariableCents: number | null;
  variableCents: number;
  savedCents: number;
  savingsGoalCents: number;
  overdueBillsCount: number;
  availableCents: number;
  previousAvailableCents: number | null;
}): string[] {
  const insights: string[] = [];
  if (input.billsCount > 0) {
    insights.push(
      `You have paid ${Math.round((input.billsPaidCents / Math.max(1, input.billsTotalCents)) * 100)}% of this month's bill total.`
    );
  }
  if (input.previousVariableCents !== null && input.previousVariableCents !== input.variableCents) {
    const lower = input.variableCents < input.previousVariableCents;
    insights.push(
      `Your variable spending is ${formatCents(Math.abs(input.variableCents - input.previousVariableCents))} ${lower ? 'lower' : 'higher'} than last month.`
    );
  }
  if (input.savingsGoalCents > input.savedCents) {
    insights.push(
      `You are ${formatCents(input.savingsGoalCents - input.savedCents)} away from this month's savings goal.`
    );
  }
  if (input.overdueBillsCount > 0) {
    insights.push(
      `${input.overdueBillsCount} payment${input.overdueBillsCount > 1 ? 's are' : ' is'} past due.`
    );
  }
  if (
    input.previousAvailableCents !== null &&
    input.availableCents > input.previousAvailableCents
  ) {
    insights.push(
      `Your available money increased by ${formatCents(input.availableCents - input.previousAvailableCents)}.`
    );
  }
  return insights.slice(0, 3);
}

export interface TipInput {
  /** This month's and last month's spend per category name. */
  categories: { name: string; currentCents: number; previousCents: number }[];
  /** Bills that are not paid and not on autopay, soonest due first. */
  unpaidManualBills: { label: string }[];
  /** The biggest emergency-fund goal, if any, with the average monthly deposits going into it. */
  emergencyFund: { label: string; remainingCents: number; monthlyPaceCents: number } | null;
  /** Paydays a typical month has (used to turn "$25 per paycheck" into a monthly figure). */
  paychecksPerMonth: number;
}

/** A short rotation of tips built only from the person's own numbers — always at least one. */
export function buildTips(input: TipInput): string[] {
  const tips: string[] = [];

  const changed = input.categories
    .filter((c) => c.previousCents > 0 && c.currentCents !== c.previousCents)
    .map((c) => ({
      ...c,
      pct: Math.round((Math.abs(c.currentCents - c.previousCents) / c.previousCents) * 100),
    }))
    .filter((c) => c.pct >= 5)
    .sort((a, b) => b.pct - a.pct)[0];
  if (changed) {
    tips.push(
      changed.currentCents < changed.previousCents
        ? `You spent ${changed.pct}% less on ${changed.name} this month than last — nice work staying on plan.`
        : `You've spent ${changed.pct}% more on ${changed.name} than last month — worth a quick look.`
    );
  }

  if (input.unpaidManualBills[0]) {
    tips.push(
      `Setting up autopay for your ${input.unpaidManualBills[0].label} bill could help you avoid it slipping past its due date.`
    );
  }

  const fund = input.emergencyFund;
  if (fund && fund.remainingCents > 0 && fund.monthlyPaceCents > 0) {
    const extraPerMonth = 2_500 * Math.max(1, input.paychecksPerMonth);
    const monthsNow = fund.remainingCents / fund.monthlyPaceCents;
    const monthsSooner = Math.round(
      monthsNow - fund.remainingCents / (fund.monthlyPaceCents + extraPerMonth)
    );
    if (monthsSooner >= 1) {
      tips.push(
        `Moving even $25 more per paycheck into your ${fund.label} would get you there about ${monthsSooner} month${monthsSooner === 1 ? '' : 's'} sooner.`
      );
    }
  }

  tips.push('Recording each expense as it happens keeps your numbers — and your score — accurate.');
  return tips;
}
