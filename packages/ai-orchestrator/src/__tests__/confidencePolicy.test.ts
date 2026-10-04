import {
  applyConfidencePolicy,
  classifyConfidence,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from '../confidencePolicy';

const USER_INTENT_THRESHOLDS = DEFAULT_CONFIDENCE_THRESHOLDS.user_intent;

describe('classifyConfidence', () => {
  it('bands a score below low as low', () => {
    expect(classifyConfidence(0.1, USER_INTENT_THRESHOLDS)).toBe('low');
    expect(classifyConfidence(0.49, USER_INTENT_THRESHOLDS)).toBe('low');
  });

  it('bands a score between low and high as medium', () => {
    expect(classifyConfidence(0.5, USER_INTENT_THRESHOLDS)).toBe('medium');
    expect(classifyConfidence(0.7, USER_INTENT_THRESHOLDS)).toBe('medium');
  });

  it('bands a score at or above high as high', () => {
    expect(classifyConfidence(0.85, USER_INTENT_THRESHOLDS)).toBe('high');
    expect(classifyConfidence(0.99, USER_INTENT_THRESHOLDS)).toBe('high');
  });
});

describe('applyConfidencePolicy — non-consequential action (e.g. navigate)', () => {
  it('low confidence always asks the user to clarify', () => {
    const outcome = applyConfidencePolicy(0.2, USER_INTENT_THRESHOLDS, false);
    expect(outcome).toEqual({ band: 'low', action: 'clarify', requiresUserConfirmation: true });
  });

  it('medium confidence is presented as a suggestion requiring confirmation', () => {
    const outcome = applyConfidencePolicy(0.6, USER_INTENT_THRESHOLDS, false);
    expect(outcome).toEqual({ band: 'medium', action: 'suggest', requiresUserConfirmation: true });
  });

  it('high confidence may preselect WITHOUT forcing confirmation', () => {
    const outcome = applyConfidencePolicy(0.95, USER_INTENT_THRESHOLDS, false);
    expect(outcome).toEqual({ band: 'high', action: 'preselect', requiresUserConfirmation: false });
  });
});

describe('applyConfidencePolicy — consequential action (financial write)', () => {
  it('ALWAYS requires user confirmation, even at high confidence', () => {
    const outcome = applyConfidencePolicy(0.99, USER_INTENT_THRESHOLDS, true);
    expect(outcome.requiresUserConfirmation).toBe(true);
    expect(outcome.band).toBe('high');
    expect(outcome.action).toBe('preselect');
  });

  it('requires confirmation at every confidence band for a consequential action', () => {
    for (const confidence of [0.05, 0.3, 0.6, 0.9, 1]) {
      expect(
        applyConfidencePolicy(confidence, USER_INTENT_THRESHOLDS, true).requiresUserConfirmation
      ).toBe(true);
    }
  });
});

describe('DEFAULT_CONFIDENCE_THRESHOLDS', () => {
  it('defines thresholds for every Jev decision kind', () => {
    expect(Object.keys(DEFAULT_CONFIDENCE_THRESHOLDS).sort()).toEqual(
      ['expense_category', 'safety_classification', 'user_intent', 'workflow_status'].sort()
    );
  });

  it('every threshold has low < high', () => {
    for (const thresholds of Object.values(DEFAULT_CONFIDENCE_THRESHOLDS)) {
      expect(thresholds.low).toBeLessThan(thresholds.high);
    }
  });
});
