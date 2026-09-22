import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  archiveSavingsGoal,
  deleteGoalActivity,
  getSavingsInsightSignals,
  listIncomeSources,
  listPaydayAssignments,
  listSavingsChallenges,
  listSavingsGoals,
  listUserGoalActivity,
  recordChallengeWeek,
  updateSavingsChallenge,
  updateSavingsGoal,
  type SavingsInsightSignals,
  type Tables,
} from '@own-my-budget/api';
import {
  buildChallengeBlocksFromRecords,
  buildSavingsActivity,
  challengeAmountsFor,
  challengeEndDate,
  challengeTargetCents,
  challengeWeeksCompleted,
  evaluateBadges,
  evaluateMissions,
  formatCents,
  formatLocalDate,
  getGoalStatus,
  isEmergencyFundGoal,
  resolveGoalCategory,
  resolveGoalFrequency,
  suggestedContributionCents,
  summarizeMonthlySavings,
  summarizeSavingsGoals,
  type BadgeId,
  type BadgeStatus,
  type ChallengeBlockDetail,
  type ChallengeType,
  type GoalCategory,
  type GoalFrequency,
  type GoalStatus,
  type MissionId,
  type MissionStatus,
  type MonthlySavingsSummary,
  type SavingsActivityEvent,
  type SavingsSummary,
} from '@own-my-budget/core';

import { formatShortDate } from '@/components/savings/format';
import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

export interface GoalActivityView {
  id: string;
  goalId: string;
  goalTitle: string;
  kind: 'deposit' | 'withdrawal';
  isChallenge: boolean;
  amountCents: number;
  occurredOn: string;
  note: string | null;
  challengeWeek: number | null;
}

export interface GoalView {
  id: string;
  title: string;
  category: GoalCategory;
  frequency: GoalFrequency;
  savedCents: number;
  targetCents: number;
  remainingCents: number;
  percent: number;
  isComplete: boolean;
  isEmergency: boolean;
  isPaused: boolean;
  status: GoalStatus;
  startDate: string;
  targetDate: string | null;
  plannedDepositCents: number | null;
  accountLabel: string | null;
  color: string | null;
  notes: string | null;
  /** What's needed per period (weekly / biweekly / monthly) to finish by the target date. */
  suggestedCents: number | null;
  /** "Assigned to paycheck: …" copy, read from payday_assignments. */
  assignmentLabel: string;
  /** Every deposit / withdrawal, newest first. */
  deposits: GoalActivityView[];
}

export interface ChallengeView {
  goalId: string;
  challengeId: string;
  title: string;
  challengeType: ChallengeType;
  cadence: string;
  multiplier: number;
  savedCents: number;
  targetCents: number;
  percent: number;
  weeksDone: number;
  totalWeeks: number;
  blocks: ChallengeBlockDetail[];
  blocksDone: number;
  /** "Week 6 of 52" — the week to log next. */
  currentWeek: number;
  startDate: string;
  endDate: string;
  notes: string | null;
  blockNotes: Record<string, string>;
  /** Deposit rows tagged with a challenge week, so a week can be undone. */
  weekDeposits: GoalActivityView[];
  color: string | null;
}

export interface BadgeView extends BadgeStatus {
  /** Earned during this visit — drives the one-time pop animation. */
  fresh: boolean;
}

/** Whether the connected database has the columns / functions from the savings design migration. */
export interface SavingsCapabilities {
  /** Goal category, frequency, dates, color, notes, pausing, per-deposit edit/delete. */
  goalDesign: boolean;
  /** Challenge multiplier, notes and week-tagged deposits. */
  challengeDesign: boolean;
}

export interface SavingsData {
  isLoading: boolean;
  isGuest: boolean;
  errorMessage: string | null;
  capabilities: SavingsCapabilities;
  goals: GoalView[];
  emergencyGoals: GoalView[];
  regularGoals: GoalView[];
  challenges: ChallengeView[];
  activity: SavingsActivityEvent[];
  summary: SavingsSummary;
  monthly: MonthlySavingsSummary;
  badges: BadgeView[];
  badgesEarnedCount: number;
  freshBadges: BadgeView[];
  missions: MissionStatus[];
  markMissionComplete: (id: MissionId) => void;
  refresh: () => Promise<void>;
  /** Soft-deletes a goal; its deposit history is kept. */
  deleteGoal: (goalId: string) => Promise<void>;
  setGoalPaused: (goalId: string, paused: boolean) => Promise<void>;
  /** Removes one deposit/withdrawal and reverses it on the goal's saved total. */
  deleteDeposit: (activityId: string) => Promise<void>;
  setChallengeMultiplier: (challenge: ChallengeView, multiplier: number) => Promise<void>;
  saveBlockNote: (challenge: ChallengeView, blockIndex: number, note: string) => Promise<void>;
  /** Logs every not-yet-done week of a block as deposits. */
  completeBlock: (challenge: ChallengeView, block: ChallengeBlockDetail) => Promise<void>;
  /** Marks one week done (logs its deposit) or undoes it (removes the deposit). */
  toggleChallengeWeek: (challenge: ChallengeView, week: number) => Promise<void>;
}

const EMPTY_INSIGHTS: SavingsInsightSignals = {
  hasBudgetPlan: false,
  budgetPlanSince: null,
  billsTotal: 0,
  billsPaid: 0,
  hasPaidOffDebt: false,
  hasAssignedPaycheck: false,
  assignedPaycheckSince: null,
  trackedDays: 0,
};

const badgeKey = (userId: string) => `own-my-budget:savings-badges:${userId}`;
const missionKey = (userId: string) => `own-my-budget:savings-missions:${userId}`;

/**
 * "Which badges have I seen" and manual mission ticks are per-device
 * conveniences. Guests keep them in memory only — the sample data resets on
 * reload, so remembering across reloads would leave badges out of sync with it.
 */
const guestMemory = new Map<string, string>();

async function readJson<T>(key: string, memoryOnly: boolean): Promise<T | null> {
  try {
    const raw = memoryOnly ? (guestMemory.get(key) ?? null) : await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown, memoryOnly: boolean) {
  try {
    if (memoryOnly) guestMemory.set(key, JSON.stringify(value));
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local-only convenience state — never surface a storage failure.
  }
}

function toActivityView(row: Tables<'goal_activity'>, goal: Tables<'savings_goals'>) {
  return {
    id: row.id,
    goalId: row.goal_id,
    goalTitle: goal.label,
    kind: row.kind === 'withdrawal' ? ('withdrawal' as const) : ('deposit' as const),
    isChallenge: goal.is_challenge,
    amountCents: row.amount_cents,
    occurredOn: row.occurred_on,
    note: row.note,
    challengeWeek: row.challenge_week ?? null,
  } satisfies GoalActivityView;
}

function assignmentLabelFor(
  goalId: string,
  assignments: Tables<'payday_assignments'>[],
  sourceNames: Map<string, string>
): string {
  const mine = assignments.filter(
    (a) => a.target_type === 'savings_goal' && a.target_id === goalId
  );
  if (mine.length === 0) return 'Not yet assigned to a paycheck';
  const shown = mine
    .slice(0, 2)
    .map(
      (a) =>
        `${formatShortDate(a.pay_date)}${
          sourceNames.get(a.income_source_id) ? ` · ${sourceNames.get(a.income_source_id)}` : ''
        } (${formatCents(a.amount_cents)})`
    );
  const more = mine.length > 2 ? ` +${mine.length - 2} more` : '';
  return `${shown.join('; ')}${more}`;
}

function toGoalView(
  goal: Tables<'savings_goals'>,
  deposits: GoalActivityView[],
  assignmentLabel: string,
  today: Date
): GoalView {
  const remainingCents = Math.max(goal.target_cents - goal.saved_cents, 0);
  const isComplete = goal.target_cents > 0 && goal.saved_cents >= goal.target_cents;
  const startDate = (goal.start_date ?? goal.created_at).slice(0, 10);
  const frequency = resolveGoalFrequency(goal.frequency);
  const isPaused = !!goal.paused_at;
  return {
    id: goal.id,
    title: goal.label,
    category: resolveGoalCategory(goal.category, goal.label),
    frequency,
    savedCents: goal.saved_cents,
    targetCents: goal.target_cents,
    remainingCents,
    percent:
      goal.target_cents > 0 ? Math.min((goal.saved_cents / goal.target_cents) * 100, 100) : 0,
    isComplete,
    isEmergency: isEmergencyFundGoal(goal.label) || goal.category === 'Emergency Fund',
    isPaused,
    status: getGoalStatus({
      savedCents: goal.saved_cents,
      targetCents: goal.target_cents,
      startDate,
      targetDate: goal.target_date,
      today,
      paused: isPaused,
    }),
    startDate,
    targetDate: goal.target_date,
    plannedDepositCents: goal.planned_deposit_cents ?? null,
    accountLabel: goal.account_label ?? null,
    color: goal.color ?? null,
    notes: goal.notes ?? null,
    suggestedCents: suggestedContributionCents(remainingCents, goal.target_date, frequency, today),
    assignmentLabel,
    deposits,
  };
}

function toChallengeView(
  goal: Tables<'savings_goals'>,
  challenge: Tables<'savings_challenges'>,
  weekDeposits: GoalActivityView[]
): ChallengeView {
  const challengeType = challenge.challenge_type as ChallengeType;
  const amounts = challengeAmountsFor(challengeType, challenge.total_weeks, goal.target_cents);

  const recordedByWeek: Record<number, number> = {};
  for (const row of weekDeposits) {
    if (row.challengeWeek) {
      recordedByWeek[row.challengeWeek] =
        (recordedByWeek[row.challengeWeek] ?? 0) + row.amountCents;
    }
  }
  // A challenge started before weeks were tagged: fall back to what the saved total covers.
  if (Object.keys(recordedByWeek).length === 0 && goal.saved_cents > 0) {
    const covered = challengeWeeksCompleted(goal.saved_cents, amounts);
    for (let week = 1; week <= covered; week += 1) recordedByWeek[week] = amounts[week - 1];
  }

  const blocks = buildChallengeBlocksFromRecords(amounts, recordedByWeek);
  const weeksDone = Object.keys(recordedByWeek).length;
  const startDate = (challenge.start_date ?? goal.start_date ?? challenge.created_at).slice(0, 10);
  const cadence = challenge.cadence === 'biweekly' ? 'biweekly' : 'weekly';
  const rawNotes = challenge.block_notes;
  const blockNotes: Record<string, string> = {};
  if (rawNotes && typeof rawNotes === 'object' && !Array.isArray(rawNotes)) {
    for (const [key, value] of Object.entries(rawNotes)) {
      if (typeof value === 'string') blockNotes[key] = value;
    }
  }

  return {
    goalId: goal.id,
    challengeId: challenge.id,
    title: goal.label,
    challengeType,
    cadence,
    multiplier: Number(challenge.multiplier ?? 1) || 1,
    savedCents: goal.saved_cents,
    targetCents: goal.target_cents,
    percent:
      goal.target_cents > 0 ? Math.min((goal.saved_cents / goal.target_cents) * 100, 100) : 0,
    weeksDone,
    totalWeeks: challenge.total_weeks,
    blocks,
    blocksDone: blocks.filter((b) => b.allDone).length,
    currentWeek: Math.min(weeksDone + 1, challenge.total_weeks),
    startDate,
    endDate: challengeEndDate(startDate, challenge.total_weeks, cadence),
    notes: challenge.notes ?? null,
    blockNotes,
    weekDeposits,
    color: goal.color ?? null,
  };
}

/**
 * Everything the Savings & Goals page (and its dialogs) render, derived in one
 * place: goals, the 52-week challenge, activity, monthly growth, achievement
 * badges and budget missions. Guests run this exact code against the in-memory
 * demo database, so nothing here branches on guest mode.
 */
export function useSavingsData(): SavingsData {
  const { userId, isReady, isGuest, guestDataVersion } = useDataUser();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [goalRows, setGoalRows] = useState<Tables<'savings_goals'>[]>([]);
  const [challengeRows, setChallengeRows] = useState<Tables<'savings_challenges'>[]>([]);
  const [activityRows, setActivityRows] = useState<Tables<'goal_activity'>[]>([]);
  const [assignments, setAssignments] = useState<Tables<'payday_assignments'>[]>([]);
  const [sourceNames, setSourceNames] = useState<Map<string, string>>(new Map());
  const [insights, setInsights] = useState<SavingsInsightSignals>(EMPTY_INSIGHTS);
  const [earnedOnById, setEarnedOnById] = useState<Partial<Record<BadgeId, string>>>({});
  const [freshIds, setFreshIds] = useState<BadgeId[]>([]);
  const [manualMissions, setManualMissions] = useState<Partial<Record<MissionId, boolean>>>({});

  const storageScope = isGuest ? `guest-${guestDataVersion}` : (userId ?? '');

  const refresh = useCallback(async () => {
    if (!isReady || !userId) return;
    try {
      const now = new Date();
      const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const nextMonthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      const trackingSince = formatLocalDate(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      );
      const [goals, challenges, activity, signals, sources, planned, storedMissions] =
        await Promise.all([
          listSavingsGoals(supabase, userId),
          listSavingsChallenges(supabase, userId),
          listUserGoalActivity(supabase, userId),
          // Badge/mission signals that reach into other features are best-effort:
          // a failure there must never blank the goals themselves.
          getSavingsInsightSignals(supabase, userId, {
            monthStart,
            nextMonthStart,
            trackingSince,
          }).catch(() => EMPTY_INSIGHTS),
          listIncomeSources(supabase, userId).catch(() => []),
          listPaydayAssignments(supabase, userId).catch(() => []),
          readJson<Partial<Record<MissionId, boolean>>>(missionKey(storageScope), isGuest),
        ]);
      setGoalRows(goals);
      setChallengeRows(challenges);
      setActivityRows(activity);
      setInsights(signals);
      setSourceNames(new Map(sources.map((s) => [s.id, s.label])));
      setAssignments(planned);
      setManualMissions(storedMissions ?? {});
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load your savings.');
    } finally {
      setIsLoading(false);
    }
  }, [isReady, userId, isGuest, storageScope]);

  useEffect(() => {
    // refresh() only sets state after awaiting the network, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, guestDataVersion]);

  const today = useMemo(() => new Date(), [goalRows, activityRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const capabilities = useMemo<SavingsCapabilities>(
    () => ({
      goalDesign: goalRows.length === 0 || 'paused_at' in goalRows[0],
      challengeDesign: challengeRows.length === 0 || 'multiplier' in challengeRows[0],
    }),
    [goalRows, challengeRows]
  );

  const activityViews = useMemo<GoalActivityView[]>(() => {
    const goalsById = new Map(goalRows.map((g) => [g.id, g]));
    return activityRows.flatMap((row) => {
      const goal = goalsById.get(row.goal_id);
      return goal ? [toActivityView(row, goal)] : [];
    });
  }, [goalRows, activityRows]);

  const challenges = useMemo<ChallengeView[]>(
    () =>
      challengeRows.flatMap((challenge) => {
        const goal = goalRows.find((g) => g.id === challenge.goal_id);
        if (!goal) return [];
        return [
          toChallengeView(
            goal,
            challenge,
            activityViews.filter((a) => a.goalId === goal.id && a.challengeWeek !== null)
          ),
        ];
      }),
    [goalRows, challengeRows, activityViews]
  );

  const challengeGoalIds = useMemo(() => new Set(challenges.map((c) => c.goalId)), [challenges]);

  const goals = useMemo<GoalView[]>(
    () =>
      goalRows
        .filter((g) => !challengeGoalIds.has(g.id) && !g.is_challenge)
        .map((g) =>
          toGoalView(
            g,
            activityViews.filter((a) => a.goalId === g.id),
            assignmentLabelFor(g.id, assignments, sourceNames),
            today
          )
        )
        // Unfinished goals first, so completed ones settle to the bottom.
        .sort((a, b) => Number(a.isComplete) - Number(b.isComplete)),
    [goalRows, challengeGoalIds, activityViews, assignments, sourceNames, today]
  );

  const summary = useMemo(
    () =>
      summarizeSavingsGoals(
        goalRows.map((g) => ({
          label: g.label,
          savedCents: g.saved_cents,
          targetCents: g.target_cents,
          isChallenge: g.is_challenge || challengeGoalIds.has(g.id),
        }))
      ),
    [goalRows, challengeGoalIds]
  );

  const monthly = useMemo(
    () =>
      summarizeMonthlySavings(
        activityViews.map((a) => ({
          kind: a.kind,
          amountCents: a.amountCents,
          occurredOn: a.occurredOn,
        })),
        today
      ),
    [activityViews, today]
  );

  const evaluated = useMemo(
    () =>
      evaluateBadges({
        goals: goalRows.map((g) => ({
          id: g.id,
          label: g.label,
          savedCents: g.saved_cents,
          targetCents: g.target_cents,
          isChallenge: g.is_challenge,
          createdAt: (g.start_date ?? g.created_at).slice(0, 10),
        })),
        challenges: challenges.map((c) => ({
          goalId: c.goalId,
          challengeType: c.challengeType,
          totalWeeks: c.totalWeeks,
          createdAt: c.startDate,
          completedWeeks: c.weeksDone,
        })),
        deposits: activityRows
          .filter((a) => a.kind === 'deposit')
          .map((a) => ({
            goalId: a.goal_id,
            amountCents: a.amount_cents,
            occurredOn: a.occurred_on,
          })),
        hasBudgetPlan: insights.hasBudgetPlan,
        budgetPlanSince: insights.budgetPlanSince,
        billsTotal: insights.billsTotal,
        billsPaid: insights.billsPaid,
        hasPaidOffDebt: insights.hasPaidOffDebt,
        hasAssignedPaycheck: insights.hasAssignedPaycheck,
        paycheckAssignedSince: insights.assignedPaycheckSince,
      }),
    [goalRows, challenges, activityRows, insights]
  );

  // Remember which badges have been earned on this device. That keeps
  // point-in-time badges (like Bill Boss) from vanishing when the month rolls
  // over, and lets us celebrate only badges earned since the last visit. The
  // first-ever sync on a device is silent so existing achievements don't all
  // pop at once.
  useEffect(() => {
    if (isLoading || !isReady || !userId) return;
    let cancelled = false;
    (async () => {
      const stored = await readJson<Partial<Record<BadgeId, string>>>(
        badgeKey(storageScope),
        isGuest
      );
      const isFirstSync = stored === null;
      const next: Partial<Record<BadgeId, string>> = { ...(stored ?? {}) };
      const fresh: BadgeId[] = [];
      for (const badge of evaluated) {
        if (badge.earned && !next[badge.id]) {
          next[badge.id] = badge.earnedOn ?? formatLocalDate(new Date());
          if (!isFirstSync) fresh.push(badge.id);
        }
      }
      if (isFirstSync || fresh.length > 0) await writeJson(badgeKey(storageScope), next, isGuest);
      if (cancelled) return;
      setEarnedOnById(next);
      setFreshIds(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluated, isLoading, isReady, userId, isGuest, storageScope]);

  const badges = useMemo<BadgeView[]>(
    () =>
      evaluated.map((badge) => {
        const remembered = earnedOnById[badge.id];
        const earned = badge.earned || !!remembered;
        return {
          ...badge,
          earned,
          earnedOn: earned ? (badge.earnedOn ?? remembered ?? null) : null,
          progress: earned ? null : badge.progress,
          fresh: freshIds.includes(badge.id),
        };
      }),
    [evaluated, earnedOnById, freshIds]
  );

  const activity = useMemo(
    () =>
      buildSavingsActivity({
        goals: goalRows.map((g) => ({
          id: g.id,
          label: g.label,
          isChallenge: g.is_challenge || challengeGoalIds.has(g.id),
          savedCents: g.saved_cents,
          targetCents: g.target_cents,
          createdOn: (g.start_date ?? g.created_at).slice(0, 10),
        })),
        activity: activityRows.map((a) => ({
          id: a.id,
          goalId: a.goal_id,
          kind: a.kind,
          amountCents: a.amount_cents,
          occurredOn: a.occurred_on,
          note: a.note,
        })),
        badges: badges.map((b) => ({
          id: b.id,
          name: b.name,
          earned: b.earned,
          earnedOn: b.earnedOn,
        })),
      }),
    [goalRows, challengeGoalIds, activityRows, badges]
  );

  const emergencyPercent = useMemo(() => {
    const emergency = goals.filter((g) => g.isEmergency);
    return emergency.length ? Math.max(...emergency.map((g) => g.percent)) : null;
  }, [goals]);

  const missions = useMemo(
    () =>
      evaluateMissions(
        {
          trackedDays: Math.min(insights.trackedDays, 7),
          depositsThisMonth: activityViews.filter(
            (a) =>
              a.kind === 'deposit' &&
              a.occurredOn.slice(0, 7) === formatLocalDate(today).slice(0, 7)
          ).length,
          emergencyPercent,
        },
        manualMissions
      ),
    [insights.trackedDays, activityViews, today, emergencyPercent, manualMissions]
  );

  const markMissionComplete = useCallback(
    (id: MissionId) => {
      setManualMissions((current) => {
        const next = { ...current, [id]: true };
        void writeJson(missionKey(storageScope), next, isGuest);
        return next;
      });
    },
    [storageScope, isGuest]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      await archiveSavingsGoal(supabase, goalId, new Date().toISOString());
      await refresh();
    },
    [refresh]
  );

  const setGoalPaused = useCallback(
    async (goalId: string, paused: boolean) => {
      await updateSavingsGoal(supabase, goalId, {
        paused_at: paused ? new Date().toISOString() : null,
      });
      await refresh();
    },
    [refresh]
  );

  const deleteDeposit = useCallback(
    async (activityId: string) => {
      await deleteGoalActivity(supabase, activityId);
      await refresh();
    },
    [refresh]
  );

  const setChallengeMultiplier = useCallback(
    async (challenge: ChallengeView, multiplier: number) => {
      await updateSavingsChallenge(supabase, challenge.challengeId, { multiplier });
      // The target follows the multiplier; already-logged weeks keep what was recorded.
      await updateSavingsGoal(supabase, challenge.goalId, {
        target_cents: challengeTargetCents(challenge.totalWeeks, multiplier),
      });
      await refresh();
    },
    [refresh]
  );

  const saveBlockNote = useCallback(
    async (challenge: ChallengeView, blockIndex: number, note: string) => {
      const next = { ...challenge.blockNotes };
      const trimmed = note.trim();
      if (trimmed) next[String(blockIndex)] = trimmed;
      else delete next[String(blockIndex)];
      await updateSavingsChallenge(supabase, challenge.challengeId, { block_notes: next });
      await refresh();
    },
    [refresh]
  );

  const completeBlock = useCallback(
    async (challenge: ChallengeView, block: ChallengeBlockDetail) => {
      const occurredOn = formatLocalDate(new Date());
      for (const week of block.weeks) {
        if (week.done) continue;
        await recordChallengeWeek(supabase, {
          goalId: challenge.goalId,
          week: week.week,
          amountCents: week.targetCents,
          occurredOn,
        });
      }
      await refresh();
    },
    [refresh]
  );

  const toggleChallengeWeek = useCallback(
    async (challenge: ChallengeView, week: number) => {
      const logged = challenge.weekDeposits.filter((d) => d.challengeWeek === week);
      if (logged.length > 0) {
        for (const row of logged) await deleteGoalActivity(supabase, row.id);
      } else {
        const target = challenge.blocks.flatMap((b) => b.weeks).find((w) => w.week === week);
        if (!target) return;
        await recordChallengeWeek(supabase, {
          goalId: challenge.goalId,
          week,
          amountCents: target.targetCents,
          occurredOn: formatLocalDate(new Date()),
        });
      }
      await refresh();
    },
    [refresh]
  );

  return {
    isLoading,
    isGuest,
    errorMessage,
    capabilities,
    goals,
    emergencyGoals: goals.filter((g) => g.isEmergency),
    regularGoals: goals.filter((g) => !g.isEmergency),
    challenges,
    activity,
    summary,
    monthly,
    badges,
    badgesEarnedCount: badges.filter((b) => b.earned).length,
    freshBadges: badges.filter((b) => b.fresh),
    missions,
    markMissionComplete,
    refresh,
    deleteGoal,
    setGoalPaused,
    deleteDeposit,
    setChallengeMultiplier,
    saveBlockNote,
    completeBlock,
    toggleChallengeWeek,
  };
}
