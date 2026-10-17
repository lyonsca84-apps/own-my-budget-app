import {
  ONBOARDING_PAY_FREQUENCIES,
  buildOnboardingSavePlan,
  type OnboardingIncomeDraft,
} from './onboarding';

export const ONBOARDING_STEPS = [
  'welcome',
  'name',
  'help',
  'incomeChoice',
  'income',
  'review',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const ONBOARDING_HELP_TOPICS = [
  'bills',
  'paychecks',
  'spending',
  'debt',
  'saving',
  'basics',
] as const;
export type OnboardingHelpTopic = (typeof ONBOARDING_HELP_TOPICS)[number];

export interface OnboardingDraft {
  version: 1;
  step: OnboardingStep;
  displayName: string;
  helpTopics: OnboardingHelpTopic[];
  wantsIncome: boolean | null;
  incomes: OnboardingIncomeDraft[];
  activeIncome: number;
  /** Assigned and persisted before the first write. A non-null list locks the review for retries. */
  incomeIds: string[] | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** IDs identify rows, not credentials. Database authorization still enforces ownership. */
export function newOnboardingIncomeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = Math.floor(Math.random() * 16);
    return (char === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

/** Device storage can be missing, old, or corrupt. Never trust it as a typed object. */
export function parseOnboardingDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (
      !d ||
      d.version !== 1 ||
      !ONBOARDING_STEPS.includes(d.step) ||
      typeof d.displayName !== 'string' ||
      d.displayName.length > 40 ||
      !Array.isArray(d.helpTopics) ||
      !d.helpTopics.every((t: unknown) =>
        ONBOARDING_HELP_TOPICS.includes(t as OnboardingHelpTopic)
      ) ||
      ![true, false, null].includes(d.wantsIncome) ||
      !Array.isArray(d.incomes) ||
      !d.incomes.length ||
      !d.incomes.every(
        (i: OnboardingIncomeDraft) =>
          i &&
          typeof i.label === 'string' &&
          typeof i.amountText === 'string' &&
          typeof i.nextPayDate === 'string' &&
          (i.frequency === null || ONBOARDING_PAY_FREQUENCIES.includes(i.frequency))
      ) ||
      !Number.isInteger(d.activeIncome) ||
      d.activeIncome < 0 ||
      d.activeIncome >= d.incomes.length ||
      !(
        d.incomeIds === null ||
        (Array.isArray(d.incomeIds) &&
          d.incomeIds.length === (d.wantsIncome ? d.incomes.length : 0) &&
          d.incomeIds.every((id: unknown) => typeof id === 'string' && UUID.test(id)) &&
          new Set(d.incomeIds).size === d.incomeIds.length)
      )
    )
      return null;
    if (d.incomeIds !== null) {
      const plan = buildOnboardingSavePlan({
        displayName: d.displayName,
        existingDisplayName: '',
        incomes: d.wantsIncome ? d.incomes : [],
      });
      if (plan.incomeRows.length !== d.incomeIds.length) return null;
    }
    // Once a save starts, return to the locked review instead of allowing edits.
    return { ...d, step: d.incomeIds !== null && d.step !== 'done' ? 'review' : d.step };
  } catch {
    return null;
  }
}
