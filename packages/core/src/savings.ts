import { formatLocalDate, parseLocalDate } from './dates';

/**
 * Savings goal math — pure, deterministic. Covers PLAN.md screens #37-42
 * (goal progress, projected completion, the 52-week challenge).
 */

export interface SavingsProgress {
  percent: number;
  remainingCents: number;
  isComplete: boolean;
}

export function calculateSavingsProgress(savedCents: number, targetCents: number): SavingsProgress {
  if (targetCents <= 0) {
    return { percent: 0, remainingCents: 0, isComplete: true };
  }
  const remainingCents = Math.max(targetCents - savedCents, 0);
  return {
    percent: Math.min((savedCents / targetCents) * 100, 100),
    remainingCents,
    isComplete: savedCents >= targetCents,
  };
}

/**
 * Simple linear projection from a steady monthly contribution — not a
 * promise, just "at this pace, here's roughly when." Returns null when
 * already met or when the contribution can never get there.
 */
export function calculateProjectedCompletionDate(
  savedCents: number,
  targetCents: number,
  monthlyContributionCents: number,
  fromDate: Date = new Date()
): string | null {
  if (savedCents >= targetCents) return null;
  if (monthlyContributionCents <= 0) return null;

  const remainingCents = targetCents - savedCents;
  const monthsNeeded = Math.ceil(remainingCents / monthlyContributionCents);
  const result = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth() + monthsNeeded,
    fromDate.getDate()
  );
  return formatLocalDate(result);
}

export type ChallengeType = 'classic_ascending' | 'flat' | 'reverse' | 'custom';

/**
 * PLAN.md screen #41: the weekly deposit amount for each week of a 52-week
 * (or custom-length) challenge. 'classic_ascending' is the traditional
 * $1-in-week-1-up-to-$52-in-week-52 challenge; 'flat' spreads a target
 * evenly; 'reverse' front-loads the big deposits (easier to finish once
 * motivation fades); 'custom' is caller-supplied and just gets echoed back
 * validated.
 */
export function generateChallengeAmounts(
  type: ChallengeType,
  totalWeeks: number,
  options?: { targetCents?: number; customAmountsCents?: number[] }
): number[] {
  if (type === 'custom') {
    const amounts = options?.customAmountsCents ?? [];
    if (amounts.length !== totalWeeks) {
      throw new Error(
        `generateChallengeAmounts: 'custom' requires exactly ${totalWeeks} amounts, got ${amounts.length}`
      );
    }
    return amounts;
  }

  if (type === 'classic_ascending' || type === 'reverse') {
    // Week N deposits N * unit cents (classic: $1/week unit = 100 cents),
    // scaled so the total matches targetCents when one is given.
    const baseSum = (totalWeeks * (totalWeeks + 1)) / 2;
    const unitCents = options?.targetCents ? options.targetCents / baseSum : 100;
    const ascending = Array.from({ length: totalWeeks }, (_, i) => Math.round((i + 1) * unitCents));
    return type === 'reverse' ? ascending.slice().reverse() : ascending;
  }

  // 'flat'
  const targetCents = options?.targetCents ?? totalWeeks * 1_000;
  const evenShare = Math.floor(targetCents / totalWeeks);
  const amounts = new Array(totalWeeks).fill(evenShare);
  // Put any leftover cents (from integer division) in the last week so the
  // amounts always sum to exactly targetCents.
  const shortfall = targetCents - evenShare * totalWeeks;
  amounts[totalWeeks - 1] += shortfall;
  return amounts;
}

// ---------------------------------------------------------------------------
// Savings & Goals view — goal categories/status, challenge weeks, achievement
// badges and budget missions. Everything below is derived from rows that
// already exist (goals, goal_activity, challenges, bills, debts, ...) so the
// UI never keeps a second, drifting copy of "what has this person achieved".
// ---------------------------------------------------------------------------

export const GOAL_CATEGORIES = [
  'Emergency Fund',
  'Vacation',
  'Home',
  'Vehicle',
  'Retirement',
  'Education',
  'Holiday',
  'Major Purchase',
  'General Savings',
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

const CATEGORY_KEYWORDS: [GoalCategory, RegExp][] = [
  ['Emergency Fund', /emergency|rainy day|cushion|safety net/i],
  ['Retirement', /retire|401\s?k|\bira\b|pension/i],
  ['Education', /school|college|tuition|education|course|degree|student/i],
  ['Holiday', /holiday|christmas|xmas|hanukkah|gifts?\b/i],
  ['Vacation', /vacation|trip|travel|getaway|cruise|honeymoon|flight/i],
  ['Vehicle', /\bcar\b|vehicle|truck|\bauto\b|motorcycle|\bbike\b|\bboat\b/i],
  ['Home', /\bhome\b|house|down ?payment|mortgage|renovat|remodel|apartment/i],
  ['Major Purchase', /laptop|computer|phone|\btv\b|furniture|appliance|purchase|camera|wedding/i],
];

/** Goals only store a label, so the category (card subtitle, artwork, emergency-fund detection) is inferred from it. */
export function inferGoalCategory(label: string): GoalCategory {
  const match = CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(label));
  return match ? match[0] : 'General Savings';
}

export function isEmergencyFundGoal(label: string): boolean {
  return inferGoalCategory(label) === 'Emergency Fund';
}

/** Emergency fund target = a few months of essential expenses; 3 is the common starting point. */
export function calculateEmergencyFundTarget(monthlyExpensesCents: number, months: number): number {
  if (!(monthlyExpensesCents > 0) || !(months > 0)) return 0;
  return Math.round(monthlyExpensesCents * months);
}

export type GoalStatus = 'completed' | 'notStarted' | 'onTrack' | 'behind' | 'inProgress';

export interface GoalStatusInput {
  savedCents: number;
  targetCents: number;
  /** When the goal was created — the start of the "expected pace" line. */
  startDate?: string | null;
  targetDate?: string | null;
  today?: Date;
}

/**
 * Compares actual progress with a straight-line pace between the start and
 * target dates (with a 10-point grace band so being a little behind never
 * reads as a failure). Goals without a target date are just 'inProgress'.
 */
export function getGoalStatus({
  savedCents,
  targetCents,
  startDate,
  targetDate,
  today = new Date(),
}: GoalStatusInput): GoalStatus {
  if (targetCents > 0 && savedCents >= targetCents) return 'completed';
  if (savedCents <= 0) return 'notStarted';
  if (!targetDate || !startDate || targetCents <= 0) return 'inProgress';

  const start = parseLocalDate(startDate.slice(0, 10)).getTime();
  const end = parseLocalDate(targetDate.slice(0, 10)).getTime();
  const span = end - start;
  if (span <= 0) return 'inProgress';

  const expected = Math.min(1, Math.max(0, (today.getTime() - start) / span));
  const actual = savedCents / targetCents;
  return actual >= expected - 0.1 ? 'onTrack' : 'behind';
}

/**
 * How much to set aside per week/month to reach the target on time. Returns
 * null when there is nothing left to save or no target date to pace against;
 * a target date already in the past collapses to a single period.
 */
export function suggestedContributionCents(
  remainingCents: number,
  targetDate: string | null | undefined,
  unit: 'weekly' | 'monthly',
  today: Date = new Date()
): number | null {
  if (remainingCents <= 0 || !targetDate) return null;
  const msLeft = parseLocalDate(targetDate.slice(0, 10)).getTime() - today.getTime();
  const daysPerPeriod = unit === 'weekly' ? 7 : 30.4375;
  const periods = Math.max(1, Math.ceil(msLeft / 86_400_000 / daysPerPeriod));
  return Math.ceil(remainingCents / periods);
}

export interface SavingsSummary {
  totalSavedCents: number;
  challengeSavedCents: number;
  emergencySavedCents: number;
  emergencyGoalCount: number;
  activeGoalCount: number;
  completedGoalCount: number;
}

export function summarizeSavingsGoals(
  goals: { label: string; savedCents: number; targetCents: number; isChallenge: boolean }[]
): SavingsSummary {
  const summary: SavingsSummary = {
    totalSavedCents: 0,
    challengeSavedCents: 0,
    emergencySavedCents: 0,
    emergencyGoalCount: 0,
    activeGoalCount: 0,
    completedGoalCount: 0,
  };
  for (const goal of goals) {
    summary.totalSavedCents += goal.savedCents;
    if (goal.isChallenge) summary.challengeSavedCents += goal.savedCents;
    if (isEmergencyFundGoal(goal.label)) {
      summary.emergencySavedCents += goal.savedCents;
      summary.emergencyGoalCount += 1;
    }
    if (goal.targetCents > 0 && goal.savedCents >= goal.targetCents)
      summary.completedGoalCount += 1;
    else summary.activeGoalCount += 1;
  }
  return summary;
}

export interface MonthlySavingsSummary {
  thisMonthCents: number;
  lastMonthCents: number;
  /** True when there is any activity in the previous month to compare against. */
  hasLastMonth: boolean;
  /** Rounded % change vs. last month; null when there is nothing to compare. */
  percentChange: number | null;
}

/** Net savings (deposits minus withdrawals) this calendar month vs. last. */
export function summarizeMonthlySavings(
  activity: { kind: string; amountCents: number; occurredOn: string }[],
  today: Date = new Date()
): MonthlySavingsSummary {
  const thisKey = today.getFullYear() * 12 + today.getMonth();
  let thisMonthCents = 0;
  let lastMonthCents = 0;
  let hasLastMonth = false;
  for (const entry of activity) {
    const date = parseLocalDate(entry.occurredOn.slice(0, 10));
    const key = date.getFullYear() * 12 + date.getMonth();
    const signed = entry.kind === 'withdrawal' ? -entry.amountCents : entry.amountCents;
    if (key === thisKey) thisMonthCents += signed;
    else if (key === thisKey - 1) {
      lastMonthCents += signed;
      hasLastMonth = true;
    }
  }
  const percentChange =
    hasLastMonth && lastMonthCents > 0
      ? Math.round(((thisMonthCents - lastMonthCents) / lastMonthCents) * 100)
      : null;
  return { thisMonthCents, lastMonthCents, hasLastMonth, percentChange };
}

// --- 52-week challenge ------------------------------------------------------

/** Weekly amounts for a stored challenge; 'custom' amounts aren't stored, so it paces like the classic. */
export function challengeAmountsFor(
  type: ChallengeType,
  totalWeeks: number,
  targetCents: number
): number[] {
  return generateChallengeAmounts(type === 'custom' ? 'classic_ascending' : type, totalWeeks, {
    targetCents,
  });
}

/** How many weeks the running saved total already covers, counted in order from week 1. */
export function challengeWeeksCompleted(savedCents: number, weeklyAmountsCents: number[]): number {
  let running = 0;
  let done = 0;
  for (const amount of weeklyAmountsCents) {
    running += amount;
    if (running > savedCents) break;
    done += 1;
  }
  return done;
}

export interface ChallengeWeek {
  week: number;
  amountCents: number;
  done: boolean;
}

export interface ChallengeBlock {
  index: number;
  startWeek: number;
  endWeek: number;
  weeks: ChallengeWeek[];
  allDone: boolean;
  doneCount: number;
}

/** The 52 weeks grouped into 5-week blocks (11 blocks for a year), as the design's challenge view shows. */
export function buildChallengeBlocks(
  weeklyAmountsCents: number[],
  savedCents: number,
  blockSize = 5
): ChallengeBlock[] {
  const weeksDone = challengeWeeksCompleted(savedCents, weeklyAmountsCents);
  const blocks: ChallengeBlock[] = [];
  for (let start = 0; start < weeklyAmountsCents.length; start += blockSize) {
    const weeks = weeklyAmountsCents.slice(start, start + blockSize).map((amountCents, offset) => ({
      week: start + offset + 1,
      amountCents,
      done: start + offset < weeksDone,
    }));
    const doneCount = weeks.filter((w) => w.done).length;
    blocks.push({
      index: blocks.length + 1,
      startWeek: weeks[0].week,
      endWeek: weeks[weeks.length - 1].week,
      weeks,
      allDone: doneCount === weeks.length,
      doneCount,
    });
  }
  return blocks;
}

/** The longest run of consecutive calendar weeks (Monday-start) that each contain at least one date. */
export function longestWeeklyStreak(dates: string[]): number {
  const weeks = new Set<number>();
  for (const iso of dates) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) continue;
    // Epoch day 0 was a Thursday, so +3 aligns week boundaries to Monday.
    weeks.add(Math.floor((Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + 3) / 7));
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const week of sorted) {
    run = previous !== null && week === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }
  return best;
}

// --- Achievement badges -----------------------------------------------------

export type BadgeId =
  | 'savingsStarter'
  | 'firstDeposit'
  | 'goalGetter'
  | 'challengeStarter'
  | 'challengeMaster'
  | 'emergencyReady'
  | 'streakSaver'
  | 'quarterComplete'
  | 'budgetBuilder'
  | 'billBoss'
  | 'debtCrusher'
  | 'paycheckPlanner';

export const BADGE_TIER_LABELS = {
  1: 'Starter',
  2: 'Progress',
  3: 'Achievement',
  4: 'Master',
} as const;

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  requirement: string;
  tier: 1 | 2 | 3 | 4;
}

/** Single source of truth for badge copy/tiers, in the order the design lays them out. */
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: 'savingsStarter',
    name: 'Savings Starter',
    requirement: 'Create your first savings goal',
    tier: 1,
  },
  {
    id: 'firstDeposit',
    name: 'First Deposit',
    requirement: 'Complete your first deposit',
    tier: 1,
  },
  { id: 'goalGetter', name: 'Goal Getter', requirement: 'Complete one savings goal', tier: 3 },
  {
    id: 'challengeStarter',
    name: 'Challenge Starter',
    requirement: 'Begin a savings challenge',
    tier: 1,
  },
  {
    id: 'challengeMaster',
    name: 'Challenge Master',
    requirement: 'Complete the full challenge',
    tier: 4,
  },
  {
    id: 'emergencyReady',
    name: 'Emergency Ready',
    requirement: 'Complete the emergency fund goal',
    tier: 3,
  },
  {
    id: 'streakSaver',
    name: 'Streak Saver',
    requirement: '4 consecutive weekly deposits',
    tier: 2,
  },
  {
    id: 'quarterComplete',
    name: 'Quarter Complete',
    requirement: '13 weeks of the challenge complete',
    tier: 2,
  },
  {
    id: 'budgetBuilder',
    name: 'Budget Builder',
    requirement: 'Create your first monthly budget',
    tier: 1,
  },
  { id: 'billBoss', name: 'Bill Boss', requirement: 'Pay all monthly bills on time', tier: 3 },
  { id: 'debtCrusher', name: 'Debt Crusher', requirement: 'Pay off one debt', tier: 4 },
  {
    id: 'paycheckPlanner',
    name: 'Paycheck Planner',
    requirement: 'Assign your first paycheck plan',
    tier: 2,
  },
];

export interface AchievementSignals {
  goals: {
    id: string;
    label: string;
    savedCents: number;
    targetCents: number;
    isChallenge: boolean;
    createdAt: string;
  }[];
  challenges: {
    goalId: string;
    challengeType: ChallengeType;
    totalWeeks: number;
    createdAt: string;
  }[];
  /** Deposit rows only (withdrawals excluded). */
  deposits: { goalId: string; amountCents: number; occurredOn: string }[];
  /** Any budget line with a planned amount. */
  hasBudgetPlan: boolean;
  /** Active monthly-cycle bills, and how many already have a payment this month. */
  billsTotal: number;
  billsPaid: number;
  hasPaidOffDebt: boolean;
  hasAssignedPaycheck: boolean;
}

export interface BadgeProgress {
  now: number;
  of: number;
  label: string;
}

export interface BadgeStatus extends BadgeDefinition {
  earned: boolean;
  /** Best-effort YYYY-MM-DD derived from the data, or null when it can't be told. */
  earnedOn: string | null;
  progress: BadgeProgress | null;
}

function earliest(dates: string[]): string | null {
  const valid = dates.map((d) => d.slice(0, 10)).filter(Boolean);
  return valid.length ? valid.reduce((a, b) => (a < b ? a : b)) : null;
}

function isGoalComplete(goal: { savedCents: number; targetCents: number }): boolean {
  return goal.targetCents > 0 && goal.savedCents >= goal.targetCents;
}

/** Date a completed goal was finished: the day of its last deposit. */
function completionDate(goalId: string, deposits: AchievementSignals['deposits']): string | null {
  const dates = deposits.filter((d) => d.goalId === goalId).map((d) => d.occurredOn.slice(0, 10));
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

export function evaluateBadges(signals: AchievementSignals): BadgeStatus[] {
  const { goals, challenges, deposits } = signals;

  const completedGoals = goals.filter(isGoalComplete);
  const emergencyGoals = goals.filter((g) => isEmergencyFundGoal(g.label));
  const completedEmergency = emergencyGoals.filter(isGoalComplete);

  // Best challenge = the one furthest along, by weeks covered by its saved total.
  let bestWeeksDone = 0;
  let bestTotalWeeks = 52;
  for (const challenge of challenges) {
    const goal = goals.find((g) => g.id === challenge.goalId);
    if (!goal) continue;
    const amounts = challengeAmountsFor(
      challenge.challengeType,
      challenge.totalWeeks,
      goal.targetCents
    );
    const weeksDone = challengeWeeksCompleted(goal.savedCents, amounts);
    if (weeksDone >= bestWeeksDone) {
      bestWeeksDone = weeksDone;
      bestTotalWeeks = challenge.totalWeeks;
    }
  }
  const hasChallenge = challenges.length > 0;
  const streak = longestWeeklyStreak(deposits.map((d) => d.occurredOn));
  const closestEmergency = emergencyGoals.reduce<(typeof emergencyGoals)[number] | null>(
    (best, g) =>
      !best || g.savedCents / (g.targetCents || 1) > best.savedCents / (best.targetCents || 1)
        ? g
        : best,
    null
  );

  const earned: Record<BadgeId, boolean> = {
    savingsStarter: goals.length > 0,
    firstDeposit: deposits.length > 0,
    goalGetter: completedGoals.length > 0,
    challengeStarter: hasChallenge,
    challengeMaster: hasChallenge && bestWeeksDone >= bestTotalWeeks,
    emergencyReady: completedEmergency.length > 0,
    streakSaver: streak >= 4,
    quarterComplete: hasChallenge && bestWeeksDone >= 13,
    budgetBuilder: signals.hasBudgetPlan,
    billBoss: signals.billsTotal > 0 && signals.billsPaid >= signals.billsTotal,
    debtCrusher: signals.hasPaidOffDebt,
    paycheckPlanner: signals.hasAssignedPaycheck,
  };

  const earnedOn: Partial<Record<BadgeId, string | null>> = {
    savingsStarter: earliest(goals.map((g) => g.createdAt)),
    firstDeposit: earliest(deposits.map((d) => d.occurredOn)),
    goalGetter: earliest(
      completedGoals.map((g) => completionDate(g.id, deposits)).filter((d): d is string => !!d)
    ),
    emergencyReady: earliest(
      completedEmergency.map((g) => completionDate(g.id, deposits)).filter((d): d is string => !!d)
    ),
    challengeStarter: earliest(challenges.map((c) => c.createdAt)),
  };

  const progress: Partial<Record<BadgeId, BadgeProgress | null>> = {
    challengeMaster: hasChallenge
      ? {
          now: bestWeeksDone,
          of: bestTotalWeeks,
          label: `${bestWeeksDone} / ${bestTotalWeeks} weeks`,
        }
      : null,
    quarterComplete: hasChallenge
      ? {
          now: Math.min(bestWeeksDone, 13),
          of: 13,
          label: `${Math.min(bestWeeksDone, 13)} / 13 weeks`,
        }
      : null,
    streakSaver: {
      now: Math.min(streak, 4),
      of: 4,
      label: `${Math.min(streak, 4)} / 4 weeks`,
    },
    emergencyReady:
      closestEmergency && closestEmergency.targetCents > 0
        ? {
            now: Math.min(closestEmergency.savedCents, closestEmergency.targetCents),
            of: closestEmergency.targetCents,
            label: `${formatWholeDollars(closestEmergency.savedCents)} of ${formatWholeDollars(closestEmergency.targetCents)}`,
          }
        : null,
    billBoss:
      signals.billsTotal > 0
        ? {
            now: signals.billsPaid,
            of: signals.billsTotal,
            label: `${signals.billsPaid} / ${signals.billsTotal} bills paid`,
          }
        : null,
  };

  return BADGE_DEFINITIONS.map((definition) => ({
    ...definition,
    earned: earned[definition.id],
    earnedOn: earned[definition.id] ? (earnedOn[definition.id] ?? null) : null,
    progress: progress[definition.id] ?? null,
  }));
}

function formatWholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

// --- Budget missions --------------------------------------------------------

export type MissionId =
  'trackExpenses' | 'monthlyDeposits' | 'emergencyCushion' | 'reviewSubscriptions';

export interface MissionDefinition {
  id: MissionId;
  title: string;
  description: string;
  /** Manual missions have no data to measure — the person marks them complete themselves. */
  manual: boolean;
}

export const MISSION_DEFINITIONS: readonly MissionDefinition[] = [
  {
    id: 'trackExpenses',
    title: 'Track every expense for 7 days',
    description: 'Log at least one transaction on each of the last 7 days.',
    manual: false,
  },
  {
    id: 'monthlyDeposits',
    title: 'Make 4 savings deposits this month',
    description: 'Small, steady deposits build the habit.',
    manual: false,
  },
  {
    id: 'emergencyCushion',
    title: 'Build your emergency cushion',
    description: 'Follows your emergency fund goal.',
    manual: false,
  },
  {
    id: 'reviewSubscriptions',
    title: 'Review subscriptions',
    description: 'Look over what you pay for every month and cancel anything unused.',
    manual: true,
  },
];

export interface MissionSignals {
  /** Distinct days, out of the last 7, that have a transaction (0-7). */
  trackedDays: number;
  depositsThisMonth: number;
  /** 0-100 for the biggest emergency-fund goal, or null when there isn't one yet. */
  emergencyPercent: number | null;
}

export interface MissionStatus extends MissionDefinition {
  progress: number;
  done: boolean;
}

export function evaluateMissions(
  signals: MissionSignals,
  manuallyCompleted: Partial<Record<MissionId, boolean>> = {}
): MissionStatus[] {
  const raw: Record<MissionId, number> = {
    trackExpenses: (signals.trackedDays / 7) * 100,
    monthlyDeposits: (signals.depositsThisMonth / 4) * 100,
    emergencyCushion: signals.emergencyPercent ?? 0,
    reviewSubscriptions: 0,
  };
  return MISSION_DEFINITIONS.map((definition) => {
    const manualDone = definition.manual && !!manuallyCompleted[definition.id];
    const progress = manualDone ? 100 : Math.min(100, Math.max(0, Math.round(raw[definition.id])));
    return { ...definition, progress, done: progress >= 100 };
  });
}
