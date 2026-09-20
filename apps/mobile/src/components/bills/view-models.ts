import type { BillWithPayments, DebtWithPayments } from '@own-my-budget/api';
import {
  calculateCreditUtilization,
  calculateDebtPaidPercent,
  deriveBillStatus,
  estimateMonthlyInterestCents,
  type BillStatus,
  type DemoBill,
  type DemoDebt,
} from '@own-my-budget/core';

/**
 * Screen-facing shapes for Bills & Debt. Real rows and guest demo data are
 * both normalized into these, so every sub-view renders one shape and never
 * cares where it came from. Columns added by migration 20260920100000 read as
 * `null` when the database hasn't been migrated yet.
 */

export type BillDisplayStatus = 'paid' | 'overdue' | 'partial' | 'due';

export interface BillItem {
  id: string;
  label: string;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  status: BillStatus;
  displayStatus: BillDisplayStatus;
  reminderEnabled: boolean;
}

export function billItemFromRow(bill: BillWithPayments, today: Date): BillItem {
  const paidCents = bill.bill_payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const { status, remainingCents } = deriveBillStatus(
    bill.amount_cents,
    paidCents,
    bill.due_date,
    today
  );
  return {
    id: bill.id,
    label: bill.label,
    dueDate: bill.due_date,
    amountCents: bill.amount_cents,
    paidCents,
    remainingCents,
    status,
    displayStatus:
      status === 'paid'
        ? 'paid'
        : status === 'overdue'
          ? 'overdue'
          : paidCents > 0
            ? 'partial'
            : 'due',
    reminderEnabled: bill.reminder_enabled ?? true,
  };
}

export function billItemFromDemo(bill: DemoBill): BillItem {
  const paidCents = bill.status === 'paid' ? bill.amountCents : 0;
  return {
    id: bill.id,
    label: bill.label,
    dueDate: bill.dueDate,
    amountCents: bill.amountCents,
    paidCents,
    remainingCents: bill.amountCents - paidCents,
    status: bill.status,
    displayStatus: bill.status === 'paid' ? 'paid' : bill.status === 'overdue' ? 'overdue' : 'due',
    reminderEnabled: true,
  };
}

export interface DebtItem {
  id: string;
  label: string;
  /** Raw debts.type: creditCard | autoLoan | mortgage | heloc | personalLoan | studentLoan | other */
  type: string;
  balanceCents: number;
  /** What the balance was when tracking began; falls back to balance + everything paid. */
  startingBalanceCents: number;
  aprBasisPoints: number;
  minimumPaymentCents: number;
  creditLimitCents: number | null;
  dueDay: number | null;
  plannedPaymentCents: number | null;
  notes: string | null;
  issuer: string | null;
  last4: string | null;
  network: string | null;
  cardStyle: string | null;
  cardTextMode: string;
  promoBalanceCents: number | null;
  promoAprBasisPoints: number | null;
  promoExpiresOn: string | null;
  lender: string | null;
  termMonths: number | null;
  startedOn: string | null;
  totalPaidCents: number;
  paidThisMonthCents: number;
  /** Oldest first, for the interest/principal estimate. */
  payments: { amountCents: number; paidOn: string }[];
  /** 0-100 paid-down progress, or null with no basis to measure. */
  paidPercent: number | null;
  paidOff: boolean;
  utilizationPercent: number | null;
  estMonthlyInterestCents: number;
}

export function isCreditCard(debt: { type: string }): boolean {
  return debt.type === 'creditCard';
}

function finishDebt(
  base: Omit<
    DebtItem,
    | 'startingBalanceCents'
    | 'paidPercent'
    | 'paidOff'
    | 'utilizationPercent'
    | 'estMonthlyInterestCents'
  > & { originalBalanceCents: number | null }
): DebtItem {
  const { originalBalanceCents, ...rest } = base;
  const startingBalanceCents = originalBalanceCents ?? base.balanceCents + base.totalPaidCents;
  return {
    ...rest,
    startingBalanceCents,
    paidPercent:
      base.balanceCents <= 0 && startingBalanceCents > 0
        ? 100
        : calculateDebtPaidPercent(
            originalBalanceCents ?? (base.totalPaidCents > 0 ? startingBalanceCents : null),
            base.balanceCents
          ),
    paidOff: base.balanceCents <= 0,
    utilizationPercent:
      base.creditLimitCents && base.creditLimitCents > 0
        ? calculateCreditUtilization(base.balanceCents, base.creditLimitCents)
        : null,
    estMonthlyInterestCents: estimateMonthlyInterestCents(base.balanceCents, base.aprBasisPoints),
  };
}

export function debtItemFromRow(row: DebtWithPayments, today: Date): DebtItem {
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const payments = [...row.debt_payments]
    .sort((a, b) => (a.paid_on < b.paid_on ? -1 : a.paid_on > b.paid_on ? 1 : 0))
    .map((p) => ({ amountCents: p.amount_cents, paidOn: p.paid_on }));
  return finishDebt({
    id: row.id,
    label: row.label,
    type: row.type,
    balanceCents: row.balance_cents,
    originalBalanceCents: row.original_balance_cents ?? null,
    aprBasisPoints: row.apr_basis_points,
    minimumPaymentCents: row.minimum_payment_cents,
    creditLimitCents: row.credit_limit_cents,
    dueDay: row.due_day,
    plannedPaymentCents: row.planned_payment_cents ?? null,
    notes: row.notes ?? null,
    issuer: row.issuer ?? null,
    last4: row.last4 ?? null,
    network: row.network ?? null,
    cardStyle: row.card_style ?? null,
    cardTextMode: row.card_text_mode ?? 'auto',
    promoBalanceCents: row.promo_balance_cents ?? null,
    promoAprBasisPoints: row.promo_apr_basis_points ?? null,
    promoExpiresOn: row.promo_expires_on ?? null,
    lender: row.lender ?? null,
    termMonths: row.term_months ?? null,
    startedOn: row.started_on ?? null,
    totalPaidCents: payments.reduce((sum, p) => sum + p.amountCents, 0),
    paidThisMonthCents: payments
      .filter((p) => p.paidOn.startsWith(monthPrefix))
      .reduce((sum, p) => sum + p.amountCents, 0),
    payments,
  });
}

export function debtItemFromDemo(debt: DemoDebt): DebtItem {
  return finishDebt({
    id: debt.id,
    label: debt.label,
    type: debt.type,
    balanceCents: debt.balanceCents,
    originalBalanceCents: null,
    aprBasisPoints: debt.aprBasisPoints,
    minimumPaymentCents: debt.minimumPaymentCents,
    creditLimitCents: debt.creditLimitCents ?? null,
    dueDay: null,
    plannedPaymentCents: null,
    notes: null,
    issuer: null,
    last4: null,
    network: null,
    cardStyle: null,
    cardTextMode: 'auto',
    promoBalanceCents: null,
    promoAprBasisPoints: null,
    promoExpiresOn: null,
    lender: null,
    termMonths: null,
    startedOn: null,
    totalPaidCents: 0,
    paidThisMonthCents: 0,
    payments: [],
  });
}

/** Human loan-type names for the design's filter chips and row captions. */
export const LOAN_TYPE_LABELS: Record<string, string> = {
  mortgage: 'Mortgage',
  heloc: 'HELOC',
  personalLoan: 'Personal loan',
  autoLoan: 'Auto loan',
  studentLoan: 'Student loan',
  other: 'Other loan',
};

export type LoanFilter = 'all' | 'mortgage' | 'heloc' | 'personalLoan' | 'other' | 'paidoff';

export const LOAN_FILTERS: { value: LoanFilter; label: string }[] = [
  { value: 'all', label: 'All accounts' },
  { value: 'mortgage', label: 'Mortgages' },
  { value: 'heloc', label: 'HELOCs' },
  { value: 'personalLoan', label: 'Personal loans' },
  { value: 'other', label: 'Other loans' },
  { value: 'paidoff', label: 'Paid off' },
];

/** "Other loans" folds auto/student/other together, matching the design's four loan groups. */
export function loanMatchesFilter(loan: DebtItem, filter: LoanFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'paidoff':
      return loan.paidOff;
    case 'other':
      return ['autoLoan', 'studentLoan', 'other'].includes(loan.type);
    default:
      return loan.type === filter;
  }
}

export function ordinal(day: number): string {
  const teens = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teens
    ? 'th'
    : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th');
  return `${day}${suffix}`;
}

/** "Sep 20" style label for a YYYY-MM-DD calendar date, without the UTC off-by-one trap. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatApr(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}
