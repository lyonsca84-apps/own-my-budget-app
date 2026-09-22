/**
 * Deterministic demo dataset matching the approved design screenshots
 * (design/App Screenshots): four pay schedules, six bills, eleven credit
 * cards, six loans/mortgages, four savings goals. Every date is relative to
 * "today", so overdue/upcoming/current-month states always look right.
 *
 * NOTE: guest mode itself no longer reads this — it runs the real query code
 * against the in-memory client in packages/api/src/guest (whose seed holds the
 * same figures). This object remains for the few screens that still render a
 * bespoke guest branch, and as a plain fixture for pure-logic tests. Money is
 * always integer cents; dates are ISO strings.
 *
 * This is intentionally simple, hand-authored data plus a couple of trivial
 * sums — the real budgeting math (money-left-to-spend, rollover, payoff
 * projections, etc.) is Phase 4/5 work in this same package.
 */

export interface DemoProfile {
  displayName: string;
  currency: 'USD';
}

export interface DemoAccount {
  id: string;
  label: string;
  balanceCents: number;
}

export interface DemoIncomeSource {
  id: string;
  label: string;
  amountCents: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextPayDate: string;
}

// The canonical definition lives in budgeting.ts, exported from the package
// root via `export * from './budgeting'` — don't redeclare or re-export it
// here too, or the root index.ts barrel export becomes ambiguous.
import type { BillStatus } from './budgeting';
import { formatLocalDate } from './dates';

export interface DemoBill {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string;
  category: string;
  status: BillStatus;
  /** Set when the bill is partly paid (status stays 'upcoming'/'overdue'). */
  paidCents?: number;
}

export type DebtType = 'creditCard' | 'autoLoan' | 'mortgage' | 'heloc' | 'personalLoan' | 'other';

export interface DemoDebt {
  id: string;
  label: string;
  type: DebtType;
  balanceCents: number;
  aprBasisPoints: number;
  minimumPaymentCents: number;
  creditLimitCents?: number;
  /** What the "Plan payment" figure on a card shows; omitted when none is set. */
  plannedPaymentCents?: number;
  issuer?: string;
  last4?: string;
}

export interface DemoSavingsGoal {
  id: string;
  label: string;
  targetCents: number;
  savedCents: number;
  targetDate: string;
  /** True for the 52-week challenge, which is tracked as a goal. */
  isChallenge?: boolean;
}

export interface DemoTransaction {
  id: string;
  label: string;
  amountCents: number;
  date: string;
  category: string;
}

export interface DemoData {
  profile: DemoProfile;
  account: DemoAccount;
  incomeSources: DemoIncomeSource[];
  bills: DemoBill[];
  debts: DemoDebt[];
  savingsGoals: DemoSavingsGoal[];
  transactions: DemoTransaction[];
}

const c = (dollars: number) => Math.round(dollars * 100);

/** Builds the demo dataset as of `today`. Same input, same output. */
export function buildDemoData(today: Date): DemoData {
  const on = (days: number) =>
    formatLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  const monthFirst = (offset: number) =>
    formatLocalDate(new Date(today.getFullYear(), today.getMonth() + offset, 1));

  const card = (
    id: string,
    label: string,
    balanceCents: number,
    minDollars: number,
    plannedDollars?: number,
    extra: Partial<DemoDebt> = {}
  ): DemoDebt => ({
    id,
    label,
    type: 'creditCard',
    balanceCents,
    aprBasisPoints: 0,
    minimumPaymentCents: c(minDollars),
    ...(plannedDollars ? { plannedPaymentCents: c(plannedDollars) } : {}),
    ...extra,
  });

  return {
    profile: { displayName: 'Carol', currency: 'USD' },

    account: { id: 'acct-checking', label: 'Checking', balanceCents: c(9860) },

    incomeSources: [
      {
        id: 'income-jamie',
        label: 'Jamie · Retail Job',
        amountCents: c(1250),
        frequency: 'biweekly',
        nextPayDate: on(6),
      },
      {
        id: 'income-sam',
        label: 'Sam · Freelance Design',
        amountCents: c(900),
        frequency: 'monthly',
        nextPayDate: monthFirst(1),
      },
      {
        id: 'income-clifton',
        label: 'Clifton Lyons · Penske',
        amountCents: c(2500),
        frequency: 'weekly',
        nextPayDate: on(5),
      },
      {
        id: 'income-carol',
        label: 'carol Lyons · Northside Hospital.',
        amountCents: c(3000),
        frequency: 'biweekly',
        nextPayDate: on(5),
      },
    ],

    bills: [
      {
        id: 'bill-rent',
        label: 'Rent',
        amountCents: c(1450),
        dueDate: monthFirst(0),
        category: 'Housing',
        status: 'paid',
        paidCents: c(1450),
      },
      {
        id: 'bill-electric',
        label: 'Electric',
        amountCents: c(145),
        dueDate: on(3),
        category: 'Utilities',
        status: 'upcoming',
      },
      {
        id: 'bill-internet',
        label: 'Internet',
        amountCents: c(70),
        dueDate: on(5),
        category: 'Utilities',
        status: 'upcoming',
        paidCents: c(35),
      },
      {
        id: 'bill-car-insurance',
        label: 'Car Insurance',
        amountCents: c(120),
        dueDate: on(8),
        category: 'Transportation',
        status: 'upcoming',
      },
      {
        id: 'bill-phone',
        label: 'Phone',
        amountCents: c(85),
        dueDate: on(-6),
        category: 'Utilities',
        status: 'overdue',
      },
      {
        id: 'bill-streaming',
        label: 'Streaming Bundle',
        amountCents: c(24),
        dueDate: on(11),
        category: 'Entertainment',
        status: 'paid',
        paidCents: c(24),
      },
    ],

    debts: [
      card('debt-card-1', 'Civic Legacy Credit Card', 148_141, 25, 50, {
        issuer: 'Bank of America',
        last4: '4821',
      }),
      card('debt-card-2', 'Civic Classic Credit Card', 79_285, 25, 50, {
        issuer: 'Bank of America',
        last4: '2210',
      }),
      card('debt-card-3', 'Chase', 1_922_100, 224, undefined, { issuer: 'Chase' }),
      card('debt-card-4', 'AA Citi', 624_438, 281.25, undefined, { issuer: 'Citi' }),
      card('debt-card-5', 'LGE Credit Card', 294_200, 40, 75),
      card('debt-card-6', 'Discover — Husband', 173_000, 35, undefined, { issuer: 'Discover' }),
      card('debt-card-7', "Sam's Club", 81_900, 29, 50),
      card('debt-card-8', 'QVC', 20_900, 41),
      card('debt-card-9', 'Belk', 24_300, 29, 50),
      card('debt-card-10', 'Apple Credit — Carol', 32_500, 25, 100, { issuer: 'Apple' }),
      card('debt-card-11', 'Apple Credit — Husband', 18_900, 25, 50, { issuer: 'Apple' }),
      {
        id: 'debt-mortgage',
        label: 'Primary Mortgage',
        type: 'mortgage',
        balanceCents: c(337_500),
        aprBasisPoints: 0,
        minimumPaymentCents: c(2368),
      },
      {
        id: 'debt-mortgage-2',
        label: 'Second Mortgage',
        type: 'mortgage',
        balanceCents: 0,
        aprBasisPoints: 0,
        minimumPaymentCents: c(975),
      },
      {
        id: 'debt-heloc',
        label: 'HELOC',
        type: 'heloc',
        balanceCents: c(64_000),
        aprBasisPoints: 750,
        minimumPaymentCents: 0,
      },
      {
        id: 'debt-discover-loan',
        label: 'Discover Personal Loan',
        type: 'personalLoan',
        balanceCents: c(2420),
        aprBasisPoints: 0,
        minimumPaymentCents: c(169),
      },
      {
        id: 'debt-affirm',
        label: 'Affirm',
        type: 'personalLoan',
        balanceCents: c(680),
        aprBasisPoints: 0,
        minimumPaymentCents: c(95),
      },
      {
        id: 'debt-other-loan',
        label: 'Other Loan',
        type: 'other',
        balanceCents: 0,
        aprBasisPoints: 0,
        minimumPaymentCents: c(93),
      },
    ],

    savingsGoals: [
      {
        id: 'goal-challenge',
        label: '52-Week Money Challenge',
        targetCents: c(1378),
        savedCents: c(15),
        targetDate: on(300),
        isChallenge: true,
      },
      {
        id: 'goal-emergency',
        label: 'Emergency Fund',
        targetCents: c(6000),
        savedCents: c(3200),
        targetDate: monthFirst(8),
      },
      {
        id: 'goal-vacation',
        label: 'Family Vacation',
        targetCents: c(2500),
        savedCents: c(900),
        targetDate: monthFirst(3),
      },
      {
        id: 'goal-laptop',
        label: 'New Laptop',
        targetCents: c(1200),
        savedCents: c(1200),
        targetDate: on(-30),
      },
    ],

    transactions: [
      ['Coffee Shop', 'Food', 0, 6.25],
      ['Kroger', 'Food', 1, 84.32],
      ['Shell', 'Transportation', 2, 41.1],
      ['Chipotle', 'Food', 3, 13.85],
      ['Target', 'Shopping', 4, 52.47],
      ['AMC Theatres', 'Entertainment', 5, 28],
      ['CVS Pharmacy', 'Health', 6, 18.64],
      ["Trader Joe's", 'Food', 8, 67.9],
      ['Shell', 'Transportation', 9, 38.75],
      ['Olive Garden', 'Food', 11, 46.2],
      ['Amazon', 'Shopping', 13, 31.99],
      ['Kroger', 'Food', 15, 91.14],
    ].map(([label, category, daysAgo, dollars], index) => ({
      id: `txn-${index + 1}`,
      label: label as string,
      amountCents: -c(dollars as number),
      date: on(-(daysAgo as number)),
      category: category as string,
    })),
  };
}

export const DEMO_DATA: DemoData = buildDemoData(new Date());

/** Sum of all bill amounts that are not yet paid (upcoming + overdue). */
export function sumUnpaidBills(data: DemoData): number {
  return data.bills
    .filter((bill) => bill.status !== 'paid')
    .reduce((total, bill) => total + bill.amountCents, 0);
}

/** Sum of all outstanding debt balances. */
export function sumDebtBalances(data: DemoData): number {
  return data.debts.reduce((total, debt) => total + debt.balanceCents, 0);
}

/** Sum of all savings goals' saved-so-far amounts. */
export function sumSavingsSaved(data: DemoData): number {
  return data.savingsGoals.reduce((total, goal) => total + goal.savedCents, 0);
}
