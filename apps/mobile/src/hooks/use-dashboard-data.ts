import { useEffect, useState } from 'react';
import {
  listAccounts,
  listBillsWithPayments,
  listPaychecks,
  type BillWithPayments,
} from '@own-my-budget/api';
import {
  DEMO_DATA,
  calculateMoneyLeftToSpend,
  deriveBillStatus,
  sumDebtBalances,
  sumSavingsSaved,
  type BillStatus,
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

export interface DashboardData {
  displayName: string;
  balanceCents: number;
  unpaidBillsCents: number;
  savingsTotalCents: number;
  debtTotalCents: number;
  moneyLeftToSpendCents: number;
  nextPaycheck: { label: string; amountCents: number; payDate: string } | null;
  billsNeedingAttention: DashboardBill[];
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

function buildGuestData(): DashboardData {
  const { profile, account, incomeSources, bills } = DEMO_DATA;
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

  return {
    displayName: profile.displayName,
    balanceCents: account.balanceCents,
    unpaidBillsCents,
    savingsTotalCents: sumSavingsSaved(DEMO_DATA),
    debtTotalCents: sumDebtBalances(DEMO_DATA),
    moneyLeftToSpendCents: calculateMoneyLeftToSpend({
      balanceCents: account.balanceCents,
      unpaidBillsCents,
    }).totalCents,
    nextPaycheck,
    billsNeedingAttention: derivedBills
      .filter((b) => b.status !== 'paid')
      .sort((a, b) => BILL_STATUS_PRIORITY[a.status] - BILL_STATUS_PRIORITY[b.status])
      .slice(0, 4),
    hasNoData: false,
    isLoading: false,
  };
}

export function useDashboardData(): DashboardData {
  const { status, user } = useAuth();
  const [realData, setRealData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    let isMounted = true;

    async function load() {
      const today = new Date();
      const [accounts, bills, paychecks] = await Promise.all([
        listAccounts(supabase, user!.id),
        listBillsWithPayments(supabase, user!.id),
        listPaychecks(supabase, user!.id),
      ]);
      if (!isMounted) return;

      const balanceCents = accounts.reduce((sum, a) => sum + a.balance_cents, 0);
      const derivedBills = bills.map((b) => billFromReal(b, today));
      const unpaidBillsCents = derivedBills
        .filter((b) => b.status !== 'paid')
        .reduce((sum, b) => sum + b.amountCents, 0);
      const latestPaycheck = paychecks[0];

      setRealData({
        displayName: user!.email?.split('@')[0] ?? 'there',
        balanceCents,
        unpaidBillsCents,
        // Debts and savings goals get their own screens in a later phase —
        // a real user with none yet truthfully has $0 here, not fake data.
        savingsTotalCents: 0,
        debtTotalCents: 0,
        moneyLeftToSpendCents: calculateMoneyLeftToSpend({ balanceCents, unpaidBillsCents })
          .totalCents,
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
        hasNoData: accounts.length === 0 && bills.length === 0 && paychecks.length === 0,
        isLoading: false,
      });
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [status, user]);

  if (status === 'guest') return buildGuestData();
  if (status === 'signedIn') {
    return (
      realData ?? {
        displayName: '',
        balanceCents: 0,
        unpaidBillsCents: 0,
        savingsTotalCents: 0,
        debtTotalCents: 0,
        moneyLeftToSpendCents: 0,
        nextPaycheck: null,
        billsNeedingAttention: [],
        hasNoData: false,
        isLoading: true,
      }
    );
  }
  // loading/signedOut/passwordRecovery never render this screen, but keep the hook total.
  return buildGuestData();
}
