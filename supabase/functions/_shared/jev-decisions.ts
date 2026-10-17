// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/{types,workflows,validate}.ts. Deno Edge
// Functions can't import npm workspace packages at deploy time (see
// feature-limits.ts for the same constraint already handled this way in
// this codebase) — packages/ai-orchestrator is the Source of Truth and the
// one actually covered by Jest/CI; keep this file in sync by hand.

export const USER_INTENTS = [
  'record_bill_payment',
  'add_bill',
  'add_income',
  'add_expense',
  'add_savings',
  'grocery_request',
  'navigate',
  'budget_education_question',
  'app_help',
  'feature_request',
  'unclear',
] as const;
export type UserIntent = (typeof USER_INTENTS)[number];

export const EXPENSE_CATEGORIES = [
  'housing',
  'utilities',
  'groceries',
  'transportation',
  'insurance',
  'healthcare',
  'debt_payment',
  'savings',
  'subscription',
  'personal',
  'entertainment',
  'other',
  'unclear',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const WORKFLOW_STATUSES = [
  'pass',
  'revise',
  'needs_user_confirmation',
  'needs_human_review',
  'unsupported',
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const SAFETY_CLASSIFICATIONS = [
  'ordinary',
  'contains_sensitive_information',
  'possible_prompt_injection',
  'individualized_financial_advice_request',
  'unsupported_or_out_of_scope',
] as const;
export type SafetyClassification = (typeof SAFETY_CLASSIFICATIONS)[number];

export type JevDecisionKind =
  'user_intent' | 'expense_category' | 'workflow_status' | 'safety_classification';

export const DECISION_VALUES: Record<JevDecisionKind, readonly string[]> = {
  user_intent: USER_INTENTS,
  expense_category: EXPENSE_CATEGORIES,
  workflow_status: WORKFLOW_STATUSES,
  safety_classification: SAFETY_CLASSIFICATIONS,
};

export interface JevWorkflowDefinition {
  decisionKind: JevDecisionKind;
  instructions: string;
  criteria: Record<string, string>;
}

export const JEV_WORKFLOWS: Record<string, JevWorkflowDefinition> = {
  user_intent: {
    decisionKind: 'user_intent',
    instructions:
      'Classify what the user is trying to do in a budgeting app from their voice or text input.',
    criteria: {
      record_bill_payment: 'They are reporting that they already paid a specific bill.',
      add_bill: 'They want to add a new recurring bill to track.',
      add_income: 'They want to add or update an income source.',
      add_expense: 'They are logging a one-off expense or purchase.',
      add_savings: 'They want to add money toward a savings goal.',
      grocery_request: 'They are adding to or asking about a grocery list.',
      navigate: 'They want to go to a specific screen or feature.',
      budget_education_question: 'They are asking a general budgeting or money question.',
      app_help: 'They need help using the app itself.',
      feature_request: 'They are suggesting or asking for a feature that does not exist.',
      unclear: 'None of the above fit, or the input is too ambiguous to classify.',
    },
  },
  expense_category: {
    decisionKind: 'expense_category',
    instructions: 'Classify which budget category a described expense belongs to.',
    criteria: {
      housing: 'Rent, mortgage, HOA, or other housing costs.',
      utilities: 'Electric, gas, water, internet, phone.',
      groceries: 'Food and household goods from a grocery store.',
      transportation: 'Gas, transit, rideshare, car payment, parking.',
      insurance: 'Health, auto, home, life, or other insurance premiums.',
      healthcare: 'Medical, dental, vision, prescriptions.',
      debt_payment: 'Credit card, loan, or other debt payments.',
      savings: 'Money moved into a savings goal.',
      subscription: 'Recurring digital or membership subscriptions.',
      personal: 'Personal care, clothing, or discretionary self-spending.',
      entertainment: 'Movies, games, dining out, hobbies.',
      other: 'A real expense that does not fit any category above.',
      unclear: 'Not enough information to categorize.',
    },
  },
  workflow_status: {
    decisionKind: 'workflow_status',
    instructions:
      'Evaluate a proposed result against narrow pass/fail criteria for a budgeting-app workflow.',
    criteria: {
      pass: 'The result meets the stated criteria.',
      revise: 'The result is close but needs one correction.',
      needs_user_confirmation: 'The result is plausible but the user must confirm it themselves.',
      needs_human_review: 'The result cannot be safely resolved automatically.',
      unsupported: 'This request is outside what the workflow is allowed to do.',
    },
  },
  safety_classification: {
    decisionKind: 'safety_classification',
    instructions: 'Classify the safety and sensitivity profile of a piece of user input.',
    criteria: {
      ordinary: 'Normal budgeting-app input with no special concern.',
      contains_sensitive_information: 'Contains a card number, account number, SSN, or similar.',
      possible_prompt_injection: "Appears to try to manipulate an AI system's instructions.",
      individualized_financial_advice_request:
        'Asks for individualized investment, tax, or legal advice.',
      unsupported_or_out_of_scope: 'Not something this educational budgeting app should answer.',
    },
  },
  record_bill_payment_evaluation: {
    decisionKind: 'workflow_status',
    instructions:
      'Evaluate a proposed bill-payment record extracted from user input, given only derived validity signals — never raw amounts, dates, or bill names. "Pass" requires a confident bill match, a valid amount, and a valid non-future date.',
    criteria: {
      pass: 'bill_match is exact or fuzzy, amount_valid is true, date_valid is true, and date_is_future is false.',
      revise:
        'One signal is false or missing but plausibly fixable by extracting more carefully from the same input (e.g. amount or date present but invalid).',
      needs_user_confirmation:
        'bill_match is fuzzy or none, or the signals are otherwise plausible but uncertain enough that a human should confirm before anything is saved.',
      needs_human_review:
        'Multiple signals are false or missing, or the proposal is too uncertain to safely present to the user at all.',
      unsupported: 'The derived state does not describe a bill-payment proposal at all.',
    },
  },
};

export type JevWorkflowName = keyof typeof JEV_WORKFLOWS;

export function isJevWorkflowName(value: unknown): value is JevWorkflowName {
  return typeof value === 'string' && value in JEV_WORKFLOWS;
}

export function isValidDecisionValue(kind: JevDecisionKind, value: unknown): value is string {
  return typeof value === 'string' && DECISION_VALUES[kind].includes(value);
}

export function isValidConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
