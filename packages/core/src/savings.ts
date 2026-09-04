import { formatLocalDate } from './dates';

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
