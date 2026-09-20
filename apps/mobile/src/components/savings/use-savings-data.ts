import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSavingsInsightSignals,
  listSavingsChallenges,
  listSavingsGoals,
  listUserGoalActivity,
  type SavingsInsightSignals,
  type Tables,
} from '@own-my-budget/api';
import {
  DEMO_DATA,
  buildChallengeBlocks,
  challengeAmountsFor,
  challengeWeeksCompleted,
  evaluateBadges,
  evaluateMissions,
  formatLocalDate,
  getGoalStatus,
  inferGoalCategory,
  isEmergencyFundGoal,
  parseLocalDate,
  suggestedContributionCents,
  summarizeMonthlySavings,
  summarizeSavingsGoals,
  type AchievementSignals,
  type BadgeId,
  type BadgeStatus,
  type ChallengeBlock,
  type ChallengeType,
  type GoalCategory,
  type GoalStatus,
  type MissionId,
  type MissionStatus,
  type MonthlySavingsSummary,
  type SavingsSummary,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
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
}

export interface GoalView {
  id: string;
  title: string;
  category: GoalCategory;
  savedCents: number;
  targetCents: number;
  remainingCents: number;
  percent: number;
  isComplete: boolean;
  isEmergency: boolean;
  status: GoalStatus;
  startDate: string;
  targetDate: string | null;
  suggestedMonthlyCents: number | null;
  recentActivity: GoalActivityView[];
}

export interface ChallengeView {
  goalId: string;
  title: string;
  challengeType: ChallengeType;
  savedCents: number;
  targetCents: number;
  percent: number;
  weeksDone: number;
  totalWeeks: number;
  blocks: ChallengeBlock[];
  blocksDone: number;
  /** The next week to log and how much is still owed toward it, or null when finished. */
  next: { week: number; dueCents: number } | null;
  startDate: string;
  endDate: string;
}

export interface BadgeView extends BadgeStatus {
  /** Earned during this visit — drives the one-time pop animation. */
  fresh: boolean;
}

export interface SavingsData {
  isLoading: boolean;
  isGuest: boolean;
  errorMessage: string | null;
  goals: GoalView[];
  emergencyGoals: GoalView[];
  regularGoals: GoalView[];
  challenges: ChallengeView[];
  activity: GoalActivityView[];
  summary: SavingsSummary;
  monthly: MonthlySavingsSummary;
  badges: BadgeView[];
  badgesEarnedCount: number;
  freshBadges: BadgeView[];
  missions: MissionStatus[];
  markMissionComplete: (id: MissionId) => void;
  refresh: () => Promise<void>;
}

const EMPTY_INSIGHTS: SavingsInsightSignals = {
  hasBudgetPlan: false,
  billsTotal: 0,
  billsPaid: 0,
  hasPaidOffDebt: false,
  hasAssignedPaycheck: false,
  trackedDays: 0,
};

const badgeKey = (userId: string) => `own-my-budget:savings-badges:${userId}`;
const missionKey = (userId: string) => `own-my-budget:savings-missions:${userId}`;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local-only convenience state — never surface a storage failure.
  }
}

function toGoalView(
  goal: Tables<'savings_goals'>,
  activity: GoalActivityView[],
  today: Date
): GoalView {
  const remainingCents = Math.max(goal.target_cents - goal.saved_cents, 0);
  const isComplete = goal.target_cents > 0 && goal.saved_cents >= goal.target_cents;
  const startDate = goal.created_at.slice(0, 10);
  return {
    id: goal.id,
    title: goal.label,
    category: inferGoalCategory(goal.label),
    savedCents: goal.saved_cents,
    targetCents: goal.target_cents,
    remainingCents,
    percent:
      goal.target_cents > 0 ? Math.min((goal.saved_cents / goal.target_cents) * 100, 100) : 0,
    isComplete,
    isEmergency: isEmergencyFundGoal(goal.label),
    status: getGoalStatus({
      savedCents: goal.saved_cents,
      targetCents: goal.target_cents,
      startDate,
      targetDate: goal.target_date,
      today,
    }),
    startDate,
    targetDate: goal.target_date,
    suggestedMonthlyCents: suggestedContributionCents(
      remainingCents,
      goal.target_date,
      'monthly',
      today
    ),
    recentActivity: activity.filter((a) => a.goalId === goal.id).slice(0, 5),
  };
}

function toChallengeView(
  goal: Tables<'savings_goals'>,
  challenge: Tables<'savings_challenges'>
): ChallengeView {
  const challengeType = challenge.challenge_type as ChallengeType;
  const amounts = challengeAmountsFor(
    challenge.challenge_type as ChallengeType,
    challenge.total_weeks,
    goal.target_cents
  );
  const weeksDone = challengeWeeksCompleted(goal.saved_cents, amounts);
  const blocks = buildChallengeBlocks(amounts, goal.saved_cents);
  const coveredCents = amounts.slice(0, weeksDone).reduce((a, b) => a + b, 0);
  const startDate = challenge.created_at.slice(0, 10);
  const periodDays = challenge.cadence === 'biweekly' ? 14 : 7;
  const end = parseLocalDate(startDate);
  end.setDate(end.getDate() + challenge.total_weeks * periodDays);

  return {
    goalId: goal.id,
    title: goal.label,
    challengeType,
    savedCents: goal.saved_cents,
    targetCents: goal.target_cents,
    percent:
      goal.target_cents > 0 ? Math.min((goal.saved_cents / goal.target_cents) * 100, 100) : 0,
    weeksDone,
    totalWeeks: challenge.total_weeks,
    blocks,
    blocksDone: blocks.filter((b) => b.allDone).length,
    next:
      weeksDone < amounts.length
        ? {
            week: weeksDone + 1,
            dueCents: Math.max(amounts[weeksDone] - (goal.saved_cents - coveredCents), 0),
          }
        : null,
    startDate,
    endDate: formatLocalDate(end),
  };
}

function useGuestSavings(): SavingsData {
  return useMemo(() => {
    const today = new Date();
    const goals: GoalView[] = DEMO_DATA.savingsGoals.map((demo) => {
      const remainingCents = Math.max(demo.targetCents - demo.savedCents, 0);
      const startDate = formatLocalDate(new Date(today.getFullYear(), today.getMonth() - 2, 1));
      return {
        id: demo.id,
        title: demo.label,
        category: inferGoalCategory(demo.label),
        savedCents: demo.savedCents,
        targetCents: demo.targetCents,
        remainingCents,
        percent: Math.min((demo.savedCents / demo.targetCents) * 100, 100),
        isComplete: demo.savedCents >= demo.targetCents,
        isEmergency: isEmergencyFundGoal(demo.label),
        status: getGoalStatus({
          savedCents: demo.savedCents,
          targetCents: demo.targetCents,
          startDate,
          targetDate: demo.targetDate,
          today,
        }),
        startDate,
        targetDate: demo.targetDate,
        suggestedMonthlyCents: suggestedContributionCents(
          remainingCents,
          demo.targetDate,
          'monthly',
          today
        ),
        recentActivity: [],
      };
    });

    const badgeSignals: AchievementSignals = {
      goals: goals.map((g) => ({
        id: g.id,
        label: g.title,
        savedCents: g.savedCents,
        targetCents: g.targetCents,
        isChallenge: false,
        createdAt: g.startDate,
      })),
      challenges: [],
      deposits: [],
      hasBudgetPlan: false,
      billsTotal: 0,
      billsPaid: 0,
      hasPaidOffDebt: false,
      hasAssignedPaycheck: false,
    };
    const badges = evaluateBadges(badgeSignals).map((b) => ({ ...b, fresh: false }));
    const emergency = goals.find((g) => g.isEmergency);

    return {
      isLoading: false,
      isGuest: true,
      errorMessage: null,
      goals,
      emergencyGoals: goals.filter((g) => g.isEmergency),
      regularGoals: goals.filter((g) => !g.isEmergency),
      challenges: [],
      activity: [],
      summary: summarizeSavingsGoals(
        goals.map((g) => ({
          label: g.title,
          savedCents: g.savedCents,
          targetCents: g.targetCents,
          isChallenge: false,
        }))
      ),
      monthly: summarizeMonthlySavings([], today),
      badges,
      badgesEarnedCount: badges.filter((b) => b.earned).length,
      freshBadges: [],
      missions: evaluateMissions({
        trackedDays: 0,
        depositsThisMonth: 0,
        emergencyPercent: emergency ? emergency.percent : null,
      }),
      markMissionComplete: () => {},
      refresh: async () => {},
    };
  }, []);
}

/**
 * Everything the Savings & Goals tab renders, derived in one place: goals,
 * the 52-week challenge, activity, monthly growth, achievement badges and
 * budget missions. Guests get a read-only view of the shared demo goals.
 */
export function useSavingsData(): SavingsData {
  const { status, user } = useAuth();
  const guest = useGuestSavings();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [goalRows, setGoalRows] = useState<Tables<'savings_goals'>[]>([]);
  const [challengeRows, setChallengeRows] = useState<Tables<'savings_challenges'>[]>([]);
  const [activityRows, setActivityRows] = useState<Tables<'goal_activity'>[]>([]);
  const [insights, setInsights] = useState<SavingsInsightSignals>(EMPTY_INSIGHTS);
  const [earnedOnById, setEarnedOnById] = useState<Partial<Record<BadgeId, string>>>({});
  const [freshIds, setFreshIds] = useState<BadgeId[]>([]);
  const [manualMissions, setManualMissions] = useState<Partial<Record<MissionId, boolean>>>({});

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (status !== 'signedIn' || !userId) return;
    setIsLoading(true);
    try {
      const now = new Date();
      const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const nextMonthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      const trackingSince = formatLocalDate(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      );
      const [goals, challenges, activity, signals, storedMissions] = await Promise.all([
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
        readJson<Partial<Record<MissionId, boolean>>>(missionKey(userId)),
      ]);
      setGoalRows(goals);
      setChallengeRows(challenges);
      setActivityRows(activity);
      setInsights(signals);
      setManualMissions(storedMissions ?? {});
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load your savings.');
    } finally {
      setIsLoading(false);
    }
  }, [status, userId]);

  const today = useMemo(() => new Date(), [goalRows, activityRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const activity = useMemo<GoalActivityView[]>(() => {
    const goalsById = new Map(goalRows.map((g) => [g.id, g]));
    return activityRows.flatMap((row) => {
      const goal = goalsById.get(row.goal_id);
      if (!goal) return [];
      return [
        {
          id: row.id,
          goalId: row.goal_id,
          goalTitle: goal.label,
          kind: row.kind === 'withdrawal' ? ('withdrawal' as const) : ('deposit' as const),
          isChallenge: goal.is_challenge,
          amountCents: row.amount_cents,
          occurredOn: row.occurred_on,
          note: row.note,
        },
      ];
    });
  }, [goalRows, activityRows]);

  const challenges = useMemo<ChallengeView[]>(
    () =>
      challengeRows.flatMap((challenge) => {
        const goal = goalRows.find((g) => g.id === challenge.goal_id);
        return goal ? [toChallengeView(goal, challenge)] : [];
      }),
    [goalRows, challengeRows]
  );

  const challengeGoalIds = useMemo(() => new Set(challenges.map((c) => c.goalId)), [challenges]);

  const goals = useMemo<GoalView[]>(
    () =>
      goalRows
        .filter((g) => !challengeGoalIds.has(g.id))
        .map((g) => toGoalView(g, activity, today))
        // Unfinished goals first, so completed ones settle to the bottom.
        .sort((a, b) => Number(a.isComplete) - Number(b.isComplete)),
    [goalRows, challengeGoalIds, activity, today]
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
        activity.map((a) => ({
          kind: a.kind,
          amountCents: a.amountCents,
          occurredOn: a.occurredOn,
        })),
        today
      ),
    [activity, today]
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
          createdAt: g.created_at,
        })),
        challenges: challengeRows.flatMap((c) =>
          c.goal_id
            ? [
                {
                  goalId: c.goal_id,
                  challengeType: c.challenge_type as ChallengeType,
                  totalWeeks: c.total_weeks,
                  createdAt: c.created_at,
                },
              ]
            : []
        ),
        deposits: activityRows
          .filter((a) => a.kind === 'deposit')
          .map((a) => ({
            goalId: a.goal_id,
            amountCents: a.amount_cents,
            occurredOn: a.occurred_on,
          })),
        hasBudgetPlan: insights.hasBudgetPlan,
        billsTotal: insights.billsTotal,
        billsPaid: insights.billsPaid,
        hasPaidOffDebt: insights.hasPaidOffDebt,
        hasAssignedPaycheck: insights.hasAssignedPaycheck,
      }),
    [goalRows, challengeRows, activityRows, insights]
  );

  // Remember which badges have been earned on this device. That keeps
  // point-in-time badges (like Bill Boss) from vanishing when the month rolls
  // over, and lets us celebrate only badges earned since the last visit. The
  // first-ever sync on a device is silent so existing achievements don't all
  // pop at once.
  useEffect(() => {
    if (isLoading || status !== 'signedIn' || !userId) return;
    let cancelled = false;
    (async () => {
      const stored = await readJson<Partial<Record<BadgeId, string>>>(badgeKey(userId));
      const isFirstSync = stored === null;
      const next: Partial<Record<BadgeId, string>> = { ...(stored ?? {}) };
      const fresh: BadgeId[] = [];
      for (const badge of evaluated) {
        if (badge.earned && !next[badge.id]) {
          next[badge.id] = badge.earnedOn ?? formatLocalDate(new Date());
          if (!isFirstSync) fresh.push(badge.id);
        }
      }
      if (isFirstSync || fresh.length > 0) await writeJson(badgeKey(userId), next);
      if (cancelled) return;
      setEarnedOnById(next);
      setFreshIds(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluated, isLoading, status, userId]);

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

  const emergencyPercent = useMemo(() => {
    const emergency = goals.filter((g) => g.isEmergency);
    return emergency.length ? Math.max(...emergency.map((g) => g.percent)) : null;
  }, [goals]);

  const missions = useMemo(
    () =>
      evaluateMissions(
        {
          trackedDays: Math.min(insights.trackedDays, 7),
          depositsThisMonth: activity.filter(
            (a) =>
              a.kind === 'deposit' &&
              a.occurredOn.slice(0, 7) === formatLocalDate(today).slice(0, 7)
          ).length,
          emergencyPercent,
        },
        manualMissions
      ),
    [insights.trackedDays, activity, today, emergencyPercent, manualMissions]
  );

  const markMissionComplete = useCallback(
    (id: MissionId) => {
      if (!userId) return;
      setManualMissions((current) => {
        const next = { ...current, [id]: true };
        void writeJson(missionKey(userId), next);
        return next;
      });
    },
    [userId]
  );

  const live: SavingsData = {
    isLoading,
    isGuest: false,
    errorMessage,
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
  };

  return status === 'guest' ? guest : live;
}
