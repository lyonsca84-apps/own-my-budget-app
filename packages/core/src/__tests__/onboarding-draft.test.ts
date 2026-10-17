import {
  newOnboardingIncomeId,
  parseOnboardingDraft,
  type OnboardingDraft,
} from '../onboarding-draft';
import { emptyIncomeDraft } from '../onboarding';

const draft: OnboardingDraft = {
  version: 1,
  step: 'income',
  displayName: 'Carol',
  helpTopics: ['bills'],
  wantsIncome: true,
  incomes: [{ ...emptyIncomeDraft(), frequency: 'weekly', amountText: '850' }],
  activeIncome: 0,
  incomeIds: null,
};

it('recovers deliberately entered partial answers without inventing a payday', () => {
  expect(parseOnboardingDraft(JSON.stringify(draft))).toEqual(draft);
  expect(parseOnboardingDraft(JSON.stringify(draft))?.incomes[0].nextPayDate).toBe('');
});

it('keeps skipped income unknown and does not require any row IDs', () => {
  const skipped = { ...draft, step: 'review', wantsIncome: false, incomeIds: [] };
  expect(parseOnboardingDraft(JSON.stringify(skipped))).toEqual(skipped);
});

it('locks a started save to review with the same IDs after a reload', () => {
  const incomeIds = [newOnboardingIncomeId()];
  const recovered = parseOnboardingDraft(JSON.stringify({ ...draft, incomeIds }));
  expect(recovered?.step).toBe('review');
  expect(recovered?.incomeIds).toEqual(incomeIds);
});

it('rejects old, broken or inconsistent recovery data', () => {
  for (const raw of [
    null,
    '{',
    '{}',
    JSON.stringify({ ...draft, version: 2 }),
    JSON.stringify({ ...draft, activeIncome: 3 }),
    JSON.stringify({ ...draft, incomes: [null] }),
    JSON.stringify({ ...draft, helpTopics: ['unknown'] }),
    JSON.stringify({ ...draft, incomeIds: [] }),
    JSON.stringify({ ...draft, incomeIds: ['bad-id'] }),
  ]) {
    expect(parseOnboardingDraft(raw)).toBeNull();
  }
});

it('keeps valid completion state if a device draft has not been cleared yet', () => {
  expect(
    parseOnboardingDraft(
      JSON.stringify({ ...draft, step: 'done', incomeIds: [newOnboardingIncomeId()] })
    )?.step
  ).toBe('done');
});
