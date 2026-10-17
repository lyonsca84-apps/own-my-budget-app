/**
 * Decision types Jev (TypeSafe's `typesafe/jev-1.13`, called through
 * OpenRouter's Decisions API) is allowed to return. Every union has an
 * explicit "unclear"/fallback member so Jev is never forced to pick a value
 * it isn't confident in just because no fallback exists.
 *
 * This file is the Source of Truth. `supabase/functions/_shared/jev-decisions.ts`
 * is a hand-maintained Deno-side duplicate of the enums + allowlisted
 * workflow criteria below — Deno Edge Functions can't import npm workspace
 * packages at deploy time (see `supabase/functions/_shared/feature-limits.ts`
 * for the same constraint already handled this way in this codebase). Keep
 * the two in sync; this package is the one actually covered by Jest/CI, so
 * treat it as authoritative if they ever disagree.
 */

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

/** A single Jev answer, already validated against DECISION_VALUES. */
export interface JevDecision {
  kind: JevDecisionKind;
  value: string;
  /** 0..1 — how concentrated Jev's probability distribution was over the allowed values. */
  confidence: number;
}

/**
 * Safe, non-sensitive metadata for one Jev or Claude call — the ONLY shape
 * allowed to reach a log line. Deliberately excludes anything resembling a
 * raw prompt, financial message, or API key: see `buildLogEntry` in
 * `metadataLog.ts`, which only ever accepts (and emits) exactly this shape.
 */
export interface OrchestrationLogEntry {
  requestId: string;
  /** The authenticated Supabase user id (a UUID) — never an email or other PII. */
  userId: string;
  workflowName: string;
  model: string;
  decision?: string;
  confidence?: number;
  latencyMs: number;
  tokensUsed?: number;
  costUsd?: number;
  iteration: number;
  status: 'pass' | 'fail' | 'unclear' | 'fallback';
  userCorrected?: boolean;
}
