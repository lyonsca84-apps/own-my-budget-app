/**
 * Deterministic demo/seed dataset — a realistic biweekly-paid household, per
 * PLAN.md §2: 8 bills, 2 credit cards, a car loan, a mortgage, 2 savings
 * goals, and a few months of transaction history. Used by guest/demo mode
 * (instant load, "Reset demo data" button) and by screens before real
 * account data exists. Money is always integer cents; dates are ISO strings.
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
  frequency: 'biweekly';
  nextPayDate: string;
}

// The canonical definition lives in budgeting.ts, exported from the package
// root via `export * from './budgeting'` — don't redeclare or re-export it
// here too, or the root index.ts barrel export becomes ambiguous.
import type { BillStatus } from './budgeting';

export interface DemoBill {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string;
  category: string;
  status: BillStatus;
}

export type DebtType = 'creditCard' | 'autoLoan' | 'mortgage';

export interface DemoDebt {
  id: string;
  label: string;
  type: DebtType;
  balanceCents: number;
  aprBasisPoints: number;
  minimumPaymentCents: number;
  creditLimitCents?: number;
}

export interface DemoSavingsGoal {
  id: string;
  label: string;
  targetCents: number;
  savedCents: number;
  targetDate: string;
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

export const DEMO_DATA: DemoData = {
  profile: { displayName: 'Jordan', currency: 'USD' },

  account: { id: 'acct-checking', label: 'Checking', balanceCents: 184_732 },

  incomeSources: [
    {
      id: 'income-primary',
      label: 'Paycheck — Riverside Retail',
      amountCents: 162_400,
      frequency: 'biweekly',
      nextPayDate: '2026-09-12',
    },
  ],

  bills: [
    {
      id: 'bill-rent',
      label: 'Rent',
      amountCents: 142_000,
      dueDate: '2026-09-01',
      category: 'Housing',
      status: 'paid',
    },
    {
      id: 'bill-electric',
      label: 'Electric',
      amountCents: 11_200,
      dueDate: '2026-09-08',
      category: 'Utilities',
      status: 'upcoming',
    },
    {
      id: 'bill-water',
      label: 'Water & Sewer',
      amountCents: 4_800,
      dueDate: '2026-09-10',
      category: 'Utilities',
      status: 'upcoming',
    },
    {
      id: 'bill-internet',
      label: 'Internet',
      amountCents: 6_500,
      dueDate: '2026-09-14',
      category: 'Utilities',
      status: 'upcoming',
    },
    {
      id: 'bill-phone',
      label: 'Phone',
      amountCents: 5_500,
      dueDate: '2026-09-15',
      category: 'Utilities',
      status: 'upcoming',
    },
    {
      id: 'bill-car-insurance',
      label: 'Car Insurance',
      amountCents: 13_900,
      dueDate: '2026-09-05',
      category: 'Insurance',
      status: 'overdue',
    },
    {
      id: 'bill-streaming',
      label: 'Streaming Bundle',
      amountCents: 2_299,
      dueDate: '2026-09-20',
      category: 'Subscriptions',
      status: 'upcoming',
    },
    {
      id: 'bill-gym',
      label: 'Gym Membership',
      amountCents: 3_500,
      dueDate: '2026-09-22',
      category: 'Subscriptions',
      status: 'upcoming',
    },
  ],

  debts: [
    {
      id: 'debt-card-1',
      label: 'Everyday Visa',
      type: 'creditCard',
      balanceCents: 214_500,
      aprBasisPoints: 2399,
      minimumPaymentCents: 6_500,
      creditLimitCents: 500_000,
    },
    {
      id: 'debt-card-2',
      label: 'Store Card',
      type: 'creditCard',
      balanceCents: 68_200,
      aprBasisPoints: 2899,
      minimumPaymentCents: 2_500,
      creditLimitCents: 150_000,
    },
    {
      id: 'debt-auto',
      label: 'Car Loan — 2022 Sedan',
      type: 'autoLoan',
      balanceCents: 1_184_000,
      aprBasisPoints: 649,
      minimumPaymentCents: 38_900,
    },
    {
      id: 'debt-mortgage',
      label: 'Mortgage',
      type: 'mortgage',
      balanceCents: 21_840_000,
      aprBasisPoints: 599,
      minimumPaymentCents: 142_000,
    },
  ],

  savingsGoals: [
    {
      id: 'goal-emergency',
      label: 'Emergency Fund',
      targetCents: 300_000,
      savedCents: 87_500,
      targetDate: '2027-03-01',
    },
    {
      id: 'goal-vacation',
      label: 'Family Vacation',
      targetCents: 150_000,
      savedCents: 42_000,
      targetDate: '2027-06-01',
    },
  ],

  transactions: [
    {
      id: 'txn-1',
      label: 'Grocery Mart',
      amountCents: -8_734,
      date: '2026-07-03',
      category: 'Groceries',
    },
    {
      id: 'txn-2',
      label: 'Riverside Retail Paycheck',
      amountCents: 162_400,
      date: '2026-07-05',
      category: 'Income',
    },
    {
      id: 'txn-3',
      label: 'Gas Station',
      amountCents: -4_210,
      date: '2026-07-08',
      category: 'Transportation',
    },
    {
      id: 'txn-4',
      label: 'Grocery Mart',
      amountCents: -9_920,
      date: '2026-07-15',
      category: 'Groceries',
    },
    {
      id: 'txn-5',
      label: 'Riverside Retail Paycheck',
      amountCents: 162_400,
      date: '2026-07-19',
      category: 'Income',
    },
    { id: 'txn-6', label: 'Pharmacy', amountCents: -2_845, date: '2026-07-22', category: 'Health' },
    {
      id: 'txn-7',
      label: 'Grocery Mart',
      amountCents: -7_610,
      date: '2026-08-01',
      category: 'Groceries',
    },
    {
      id: 'txn-8',
      label: 'Riverside Retail Paycheck',
      amountCents: 162_400,
      date: '2026-08-02',
      category: 'Income',
    },
    {
      id: 'txn-9',
      label: 'Gas Station',
      amountCents: -4_580,
      date: '2026-08-09',
      category: 'Transportation',
    },
    {
      id: 'txn-10',
      label: 'Grocery Mart',
      amountCents: -10_215,
      date: '2026-08-14',
      category: 'Groceries',
    },
    {
      id: 'txn-11',
      label: 'Riverside Retail Paycheck',
      amountCents: 162_400,
      date: '2026-08-16',
      category: 'Income',
    },
    {
      id: 'txn-12',
      label: 'Restaurant',
      amountCents: -5_400,
      date: '2026-08-23',
      category: 'Dining',
    },
    {
      id: 'txn-13',
      label: 'Grocery Mart',
      amountCents: -8_990,
      date: '2026-08-29',
      category: 'Groceries',
    },
    {
      id: 'txn-14',
      label: 'Riverside Retail Paycheck',
      amountCents: 162_400,
      date: '2026-08-30',
      category: 'Income',
    },
    {
      id: 'txn-15',
      label: 'Gas Station',
      amountCents: -4_350,
      date: '2026-09-02',
      category: 'Transportation',
    },
  ],
};

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
