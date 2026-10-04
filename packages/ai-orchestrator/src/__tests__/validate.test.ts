import { isValidConfidence, isValidDecisionValue, parseJevDecision } from '../validate';
import { PHRASE_FIXTURES } from './fixtures';

describe('isValidDecisionValue', () => {
  it('accepts every value in the allowlist for each decision kind', () => {
    expect(isValidDecisionValue('user_intent', 'record_bill_payment')).toBe(true);
    expect(isValidDecisionValue('expense_category', 'groceries')).toBe(true);
    expect(isValidDecisionValue('workflow_status', 'needs_human_review')).toBe(true);
    expect(isValidDecisionValue('safety_classification', 'possible_prompt_injection')).toBe(true);
  });

  it('rejects a value not in the allowlist', () => {
    expect(isValidDecisionValue('user_intent', 'delete_everything')).toBe(false);
    expect(isValidDecisionValue('expense_category', 'crypto')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidDecisionValue('user_intent', 42)).toBe(false);
    expect(isValidDecisionValue('user_intent', null)).toBe(false);
    expect(isValidDecisionValue('user_intent', undefined)).toBe(false);
    expect(isValidDecisionValue('user_intent', { value: 'navigate' })).toBe(false);
  });

  it('every fixture phrase expects an intent that is itself in the allowlist', () => {
    for (const fixture of PHRASE_FIXTURES) {
      expect(isValidDecisionValue('user_intent', fixture.expectedIntent)).toBe(true);
    }
  });
});

describe('isValidConfidence', () => {
  it('accepts numbers in [0, 1]', () => {
    expect(isValidConfidence(0)).toBe(true);
    expect(isValidConfidence(0.5)).toBe(true);
    expect(isValidConfidence(1)).toBe(true);
  });

  it('rejects out-of-range, non-finite, or non-number values', () => {
    expect(isValidConfidence(-0.01)).toBe(false);
    expect(isValidConfidence(1.01)).toBe(false);
    expect(isValidConfidence(Number.NaN)).toBe(false);
    expect(isValidConfidence(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidConfidence('0.9')).toBe(false);
    expect(isValidConfidence(undefined)).toBe(false);
    expect(isValidConfidence(null)).toBe(false);
  });
});

describe('parseJevDecision — invalid and incomplete responses', () => {
  it('parses a well-formed response', () => {
    const result = parseJevDecision('user_intent', { value: 'add_expense', confidence: 0.92 });
    expect(result).toEqual({ kind: 'user_intent', value: 'add_expense', confidence: 0.92 });
  });

  it('returns null for a decision value outside the allowlist (model hallucination)', () => {
    expect(
      parseJevDecision('user_intent', { value: 'transfer_money', confidence: 0.9 })
    ).toBeNull();
  });

  it('returns null when confidence is missing', () => {
    expect(parseJevDecision('user_intent', { value: 'navigate' })).toBeNull();
  });

  it('returns null when confidence is out of range', () => {
    expect(parseJevDecision('user_intent', { value: 'navigate', confidence: 1.5 })).toBeNull();
  });

  it('returns null for null, undefined, arrays, and primitives', () => {
    expect(parseJevDecision('user_intent', null)).toBeNull();
    expect(parseJevDecision('user_intent', undefined)).toBeNull();
    expect(parseJevDecision('user_intent', [])).toBeNull();
    expect(parseJevDecision('user_intent', 'add_expense')).toBeNull();
    expect(parseJevDecision('user_intent', 42)).toBeNull();
  });

  it('returns null for an empty object or one missing both fields', () => {
    expect(parseJevDecision('user_intent', {})).toBeNull();
  });

  it('returns null when the value belongs to a different decision kind', () => {
    // 'groceries' is a valid expense_category but not a valid user_intent.
    expect(parseJevDecision('user_intent', { value: 'groceries', confidence: 0.8 })).toBeNull();
  });
});
