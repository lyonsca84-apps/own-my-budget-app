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
  canUseAdvancedDebtScenarios,
  type PayoffStrategy,
  type PlanTier,
} from '@own-my-budget/core';

import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  billItemFromRow,
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
  /** Guest mode runs the same code against the sample database — use for copy only. */
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
 * Loads everything Bills & Debt shows through the normal API. Guests run the
 * exact same code — `supabase` is the in-memory sample database for them.
 * The optional pieces added by migration 20260920100000 (payment plans,
 * payoff prefs) fail soft, so an un-migrated database degrades to "nothing
 * planned yet" instead of breaking the screen.
 */
export function useBillsDebtData(): BillsDebtData {
  const { userId, isReady, isGuest, guestDataVersion } = useDataUser();
  const [bills, setBills] = useState<BillItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [plans, setPlans] = useState<Record<string, PlanSummary>>({});
  const [prefs, setPrefs] = useState<PayoffPrefs>(DEFAULT_PREFS);
  const [canUseAvalanche, setCanUseAvalanche] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const reload = useCallback(async () => {
    if (!isReady || !userId) return;
    // Only the very first load shows the loading state — coming back from a
    // payment dialog refreshes in place so the layout never flashes.
    if (!hasLoaded.current) setIsLoading(true);
    try {
      const [billRows, debtRows, planRows, payoffRow, account] = await Promise.all([
        listBillsWithPayments(supabase, userId),
        listDebtsWithPayments(supabase, userId),
        listPaydayAssignments(supabase, userId).catch(() => []),
        getPayoffPlan(supabase, userId).catch(() => null),
        getCurrentAccount(supabase, userId).catch(() => null),
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
    // guestDataVersion: reload after the guest sample data is reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, userId, guestDataVersion]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const setBillReminder = useCallback(async (billId: string, enabled: boolean) => {
    // Optimistic: flip the checkbox now, roll back if the save fails.
    setBills((list) => list.map((b) => (b.id === billId ? { ...b, reminderEnabled: enabled } : b)));
    try {
      await updateBill(supabase, billId, { reminder_enabled: enabled });
    } catch (error) {
      setBills((list) =>
        list.map((b) => (b.id === billId ? { ...b, reminderEnabled: !enabled } : b))
      );
      setErrorMessage(error instanceof Error ? error.message : "We couldn't change that reminder.");
    }
  }, []);

  const removeDebt = useCallback(
    async (debtId: string) => {
      try {
        await archiveDebt(supabase, debtId);
        await reload();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "We couldn't remove that account."
        );
      }
    },
    [reload]
  );

  const savePrefs = useCallback(
    async (changes: Partial<PayoffPrefs>) => {
      const next = { ...prefs, ...changes };
      setPrefs(next);
      if (!userId) return;
      try {
        // Goal columns are only sent once the goal is in play, so saving
        // strategy/extra keeps working on a database that hasn't had
        // migration 20260920100000 applied yet.
        const touchesGoal =
          'goalTargetCents' in changes ||
          'goalTargetDate' in changes ||
          'goalMonthlyCents' in changes;
        await savePayoffPlan(supabase, userId, {
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
    [prefs, userId]
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
