import { DECISION_VALUES } from '../types';
import { isJevWorkflowName, JEV_WORKFLOWS } from '../workflows';

describe('JEV_WORKFLOWS allowlist', () => {
  it('defines the four initial workflows from the project brief, plus the Phase 2 bill-payment evaluation workflow', () => {
    expect(Object.keys(JEV_WORKFLOWS).sort()).toEqual(
      [
        'expense_category',
        'safety_classification',
        'user_intent',
        'workflow_status',
        'record_bill_payment_evaluation',
      ].sort()
    );
  });

  it('every workflow criteria key is a valid value for its decision kind, with none missing', () => {
    for (const workflow of Object.values(JEV_WORKFLOWS)) {
      const allowedValues = DECISION_VALUES[workflow.decisionKind];
      const criteriaKeys = Object.keys(workflow.criteria);
      expect(criteriaKeys.sort()).toEqual([...allowedValues].sort());
    }
  });

  it('every workflow includes an "unclear" or equivalent fallback value', () => {
    expect(Object.keys(JEV_WORKFLOWS.user_intent.criteria)).toContain('unclear');
    expect(Object.keys(JEV_WORKFLOWS.expense_category.criteria)).toContain('unclear');
    expect(Object.keys(JEV_WORKFLOWS.workflow_status.criteria)).toContain('unsupported');
    expect(Object.keys(JEV_WORKFLOWS.safety_classification.criteria)).toContain(
      'unsupported_or_out_of_scope'
    );
  });

  it('every criteria description is a non-empty string (Jev needs real guidance, not a blank)', () => {
    for (const workflow of Object.values(JEV_WORKFLOWS)) {
      for (const description of Object.values(workflow.criteria)) {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('isJevWorkflowName', () => {
  it('accepts a known workflow name', () => {
    expect(isJevWorkflowName('user_intent')).toBe(true);
  });

  it('rejects an arbitrary client-supplied workflow name — the allowlist guarantee', () => {
    expect(isJevWorkflowName('custom_prompt')).toBe(false);
    expect(isJevWorkflowName('delete_all_bills')).toBe(false);
    expect(isJevWorkflowName(42)).toBe(false);
    expect(isJevWorkflowName(null)).toBe(false);
  });
});
