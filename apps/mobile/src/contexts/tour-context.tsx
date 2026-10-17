import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  listBillsWithPayments,
  listCategories,
  listDebtsWithPayments,
  listIncomeSources,
  listSavingsGoals,
} from '@own-my-budget/api';
import {
  TOUR_SECTIONS,
  dismissTour,
  initialTourState,
  nextSection,
  parseTourState,
  pauseTour,
  previousSection,
  projectMonthIncomeCents,
  recordSectionResult,
  resumeTour,
  startTour,
  tourStorageKey,
  type TourCountKey,
  type TourSection,
  type TourSectionResult,
  type TourState,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * Budget Buddy's guided tour: progress for the signed-in user, kept on this
 * device (like the onboarding draft) so it survives reloads and can be paused,
 * resumed and replayed. The tour never writes budget data — it opens the
 * app's existing forms and only *reads* counts to show what's already saved.
 */

export type TourCounts = Record<TourCountKey, number> & { monthIncomeCents: number };

export interface TourContextValue {
  state: TourState;
  /** Tour progress has been read from the device. */
  loaded: boolean;
  /** Progress couldn't be kept on this device (shown, never silent). */
  storageError: boolean;
  section: TourSection;
  counts: TourCounts | null;
  countsError: boolean;
  refreshCounts: () => Promise<TourCounts | null>;
  start: (options?: { replay?: boolean; startAt?: number }) => void;
  next: () => void;
  back: () => void;
  pause: () => void;
  resume: () => void;
  dismiss: () => void;
  record: (result: TourSectionResult) => void;
  /** Opens the current section's route (used after a detour). */
  showSection: () => void;
  /** Called by the first-login Welcome screen before onboarding finishes. */
  setFromOnboarding: (choice: 'guided' | 'explore' | 'later') => Promise<void>;
}

const TourContext = createContext<TourContextValue | null>(null);

function sectionHref(section: TourSection): Href {
  return (
    section.routeParams ? { pathname: section.route, params: section.routeParams } : section.route
  ) as Href;
}

/** Leaves any open form/modal, then opens the section's real tab or screen. */
function openSection(section: TourSection) {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(sectionHref(section));
}

async function loadCounts(userId: string): Promise<TourCounts> {
  const [incomes, categories, bills, debts, goals] = await Promise.all([
    listIncomeSources(supabase, userId),
    listCategories(supabase, userId),
    listBillsWithPayments(supabase, userId),
    listDebtsWithPayments(supabase, userId),
    listSavingsGoals(supabase, userId),
  ]);
  const activeDebts = debts.filter((d) => d.archived_at === null);
  const now = new Date();
  return {
    incomeSources: incomes.length,
    categories: categories.length,
    bills: bills.filter((b) => b.archived_at === null).length,
    cards: activeDebts.filter((d) => d.type === 'creditCard').length,
    loans: activeDebts.filter((d) => d.type !== 'creditCard').length,
    goals: goals.filter((g) => g.archived_at === null).length,
    monthIncomeCents: projectMonthIncomeCents(
      incomes.map((s) => ({
        frequency: s.frequency,
        nextPayDate: s.next_pay_date,
        amountCents: s.amount_cents,
      })),
      now.getFullYear(),
      now.getMonth()
    ),
  };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const userId = status === 'signedIn' || status === 'needsOnboarding' ? (user?.id ?? null) : null;

  const [state, setState] = useState<TourState>(initialTourState);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  // Counts are tagged with their user so another account never sees them.
  const [countsFor, setCountsFor] = useState<{ userId: string; counts: TourCounts } | null>(null);
  const [countsError, setCountsError] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const counts = countsFor && countsFor.userId === userId ? countsFor.counts : null;

  // Load this user's progress. A different user simply loads their own; until
  // then `loaded` is false, so nothing from the previous user is shown.
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    AsyncStorage.getItem(tourStorageKey(userId))
      .then((raw) => {
        if (!isMounted) return;
        setState(parseTourState(raw) ?? initialTourState());
        setLoadedFor(userId);
      })
      .catch(() => {
        if (!isMounted) return;
        setStorageError(true);
        setLoadedFor(userId);
      });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Serialized writes so an older state never lands after a newer one.
  const persist = useCallback(
    (next: TourState) => {
      if (!userId) return Promise.resolve();
      const write = writes.current
        .catch(() => {})
        .then(() => AsyncStorage.setItem(tourStorageKey(userId), JSON.stringify(next)));
      writes.current = write;
      return write.then(
        () => setStorageError(false),
        () => setStorageError(true)
      );
    },
    [userId]
  );

  // Set by actions that should open the (new) current section once React commits it.
  const pendingNavigation = useRef(false);

  const update = useCallback(
    (change: (current: TourState) => TourState, navigate = false) => {
      if (navigate) pendingNavigation.current = true;
      setState((current) => {
        const next = change(current);
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    if (!pendingNavigation.current) return;
    pendingNavigation.current = false;
    if (state.status === 'active') openSection(TOUR_SECTIONS[state.current]);
    else if (state.status === 'completed') openSection(TOUR_SECTIONS[0]);
  }, [state]);

  const refreshCounts = useCallback(async () => {
    if (!userId) return null;
    try {
      const next = await loadCounts(userId);
      setCountsFor({ userId, counts: next });
      setCountsError(false);
      return next;
    } catch {
      setCountsError(true);
      return null;
    }
  }, [userId]);

  const value: TourContextValue = {
    state,
    loaded: userId !== null && loadedFor === userId,
    storageError,
    section: TOUR_SECTIONS[state.current],
    counts,
    countsError,
    refreshCounts,
    start: (options) => update((s) => startTour(s, options), true),
    next: () => update(nextSection, true),
    back: () => update(previousSection, true),
    pause: () => update(pauseTour),
    resume: () => update(resumeTour, true),
    dismiss: () => update(dismissTour),
    record: (result) => update((s) => recordSectionResult(s, TOUR_SECTIONS[s.current].id, result)),
    showSection: () => openSection(TOUR_SECTIONS[state.current]),
    setFromOnboarding: async (choice) => {
      const base = initialTourState();
      const next: TourState =
        choice === 'guided'
          ? startTour(base)
          : choice === 'later'
            ? { ...base, status: 'paused' }
            : dismissTour(base);
      setState(next);
      await persist(next);
    },
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const value = useContext(TourContext);
  if (!value) throw new Error('useTour must be used inside <TourProvider>');
  return value;
}
