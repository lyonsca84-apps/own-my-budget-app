import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  archiveDebt,
  getCurrentAccount,
  getPayoffPlan,
  listBillsWithPayments,
  listDebtsWithPayments,
  listPaydayAssignments,
  savePayoffPlan,
  updateBill,
} from '@own-my-budget/api';
import {
  DEMO_DATA,
  canUseAdvancedDebtScenarios,
  type PayoffStrategy,
  type PlanTier,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  billItemFromDemo,
  billItemFromRow,
  debtItemFromDemo,
  debtItemFromRow,
  isCreditCard,
  type BillItem,
  type DebtItem,
} from './view-models';

export interface PlanSummary {
  totalCents: number;
  paydayCount: number;
}

export interface PayoffPrefs {
  strategy: PayoffStrategy;
  extraMonthlyCents: number;
  goalTargetCents: number | null;
  goalTargetDate: string | null;
  goalMonthlyCents: number | null;
}

const DEFAULT_PREFS: PayoffPrefs = {
  strategy: 'snowball',
  extraMonthlyCents: 0,
  goalTargetCents: null,
  goalTargetDate: null,
  goalMonthlyCents: null,
};

export interface BillsDebtData {
  /** Guests see read-only sample data; every write is redirected to sign-up. */
  isGuest: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  bills: BillItem[];
  cards: DebtItem[];
  loans: DebtItem[];
  /** "Assigned to paycheck" totals keyed `bill:<id>` / `debt:<id>`. */
  plans: Record<string, PlanSummary>;
  prefs: PayoffPrefs;
  /** Avalanche optimizer is a Premium feature — gated through core's featureGate. */
  canUseAvalanche: boolean;
  reload: () => Promise<void>;
  setBillReminder: (billId: string, enabled: boolean) => Promise<void>;
  removeDebt: (debtId: string) => Promise<void>;
  savePrefs: (changes: Partial<PayoffPrefs>) => Promise<void>;
}

/**
 * Loads everything Bills & Debt shows. Signed-in users get their real rows;
 * guests get the shared demo dataset (same as the Dashboard). The optional
 * pieces added by migration 20260920100000 (payment plans, payoff prefs) fail
 * soft, so an un-migrated database degrades to "nothing planned yet" instead
 * of breaking the screen.
 */
export function useBillsDebtData(): BillsDebtData {
  const { status, user } = useAuth();
  const isGuest = status === 'guest';
  const [bills, setBills] = useState<BillItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [plans, setPlans] = useState<Record<string, PlanSummary>>({});
  const [prefs, setPrefs] = useState<PayoffPrefs>(DEFAULT_PREFS);
  const [canUseAvalanche, setCanUseAvalanche] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const reload = useCallback(async () => {
    if (isGuest) {
      setBills(DEMO_DATA.bills.map(billItemFromDemo));
      setDebts(DEMO_DATA.debts.map(debtItemFromDemo));
      setPlans({});
      setIsLoading(false);
      return;
    }
    if (status !== 'signedIn' || !user) return;
    // Only the very first load shows the loading state — coming back from a
    // payment modal refreshes in place so the layout never flashes.
    if (!hasLoaded.current) setIsLoading(true);
    try {
      const [billRows, debtRows, planRows, payoffRow, account] = await Promise.all([
        listBillsWithPayments(supabase, user.id),
        listDebtsWithPayments(supabase, user.id),
        listPaydayAssignments(supabase, user.id).catch(() => []),
        getPayoffPlan(supabase, user.id).catch(() => null),
        getCurrentAccount(supabase, user.id).catch(() => null),
      ]);
      const now = new Date();
      setBills(billRows.map((row) => billItemFromRow(row, now)));
      setDebts(debtRows.map((row) => debtItemFromRow(row, now)));

      const summaries: Record<string, PlanSummary> = {};
      for (const row of planRows) {
        if (row.target_type !== 'bill' && row.target_type !== 'debt') continue;
        const key = `${row.target_type}:${row.target_id}`;
        const current = summaries[key] ?? { totalCents: 0, paydayCount: 0 };
        summaries[key] = {
          totalCents: current.totalCents + row.amount_cents,
          paydayCount: current.paydayCount + 1,
        };
      }
      setPlans(summaries);

      setPrefs(
        payoffRow
          ? {
              strategy: payoffRow.strategy === 'avalanche' ? 'avalanche' : 'snowball',
              extraMonthlyCents: payoffRow.extra_monthly_cents,
              goalTargetCents: payoffRow.card_goal_target_cents ?? null,
              goalTargetDate: payoffRow.card_goal_target_date ?? null,
              goalMonthlyCents: payoffRow.card_goal_monthly_cents ?? null,
            }
          : DEFAULT_PREFS
      );

      const plan = (account?.entitlement.plan_tier ?? 'free') as PlanTier;
      setCanUseAvalanche(canUseAdvancedDebtScenarios({ plan }).allowed);
      setErrorMessage(null);
      hasLoaded.current = true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't load your bills and debt just now."
      );
    } finally {
      setIsLoading(false);
    }
  }, [isGuest, status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const setBillReminder = useCallback(
    async (billId: string, enabled: boolean) => {
      const previous = bills;
      setBills((list) =>
        list.map((b) => (b.id === billId ? { ...b, reminderEnabled: enabled } : b))
      );
      if (isGuest) return;
      try {
        await updateBill(supabase, billId, { reminder_enabled: enabled });
      } catch (error) {
        setBills(previous);
        setErrorMessage(
          error instanceof Error ? error.message : "We couldn't change that reminder."
        );
      }
    },
    [bills, isGuest]
  );

  const removeDebt = useCallback(
    async (debtId: string) => {
      if (isGuest) return;
      try {
        await archiveDebt(supabase, debtId);
        await reload();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "We couldn't remove that account."
        );
      }
    },
    [isGuest, reload]
  );

  const savePrefs = useCallback(
    async (changes: Partial<PayoffPrefs>) => {
      const next = { ...prefs, ...changes };
      setPrefs(next);
      if (isGuest || !user) return;
      try {
        // Goal columns are only sent once the goal is in play, so saving
        // strategy/extra keeps working on a database that hasn't had
        // migration 20260920100000 applied yet.
        const touchesGoal =
          'goalTargetCents' in changes ||
          'goalTargetDate' in changes ||
          'goalMonthlyCents' in changes;
        await savePayoffPlan(supabase, user.id, {
          strategy: next.strategy,
          extra_monthly_cents: next.extraMonthlyCents,
          ...(touchesGoal
            ? {
                card_goal_target_cents: next.goalTargetCents,
                card_goal_target_date: next.goalTargetDate,
                card_goal_monthly_cents: next.goalMonthlyCents,
              }
            : {}),
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "We couldn't save your payoff settings."
        );
      }
    },
    [isGuest, prefs, user]
  );

  const cards = useMemo(() => debts.filter(isCreditCard), [debts]);
  const loans = useMemo(() => debts.filter((d) => !isCreditCard(d)), [debts]);

  return {
    isGuest,
    isLoading,
    errorMessage,
    bills,
    cards,
    loans,
    plans,
    prefs,
    canUseAvalanche,
    reload,
    setBillReminder,
    removeDebt,
    savePrefs,
  };
}
