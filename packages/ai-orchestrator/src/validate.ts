import { DECISION_VALUES, type JevDecision, type JevDecisionKind } from './types';

export function isValidDecisionValue(kind: JevDecisionKind, value: unknown): value is string {
  return typeof value === 'string' && (DECISION_VALUES[kind] as readonly string[]).includes(value);
}

export function isValidConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Validates a raw, already-parsed response against one expected decision
 * kind. Returns null on ANY mismatch (wrong type, out-of-allowlist value,
 * missing confidence, malformed JSON shape) — callers must treat null as
 * "fall back safely," never as "assume a default decision." This is the one
 * place that may ever accept a Jev response as trustworthy.
 */
export function parseJevDecision(kind: JevDecisionKind, raw: unknown): JevDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>).value;
  const confidence = (raw as Record<string, unknown>).confidence;
  if (!isValidDecisionValue(kind, value) || !isValidConfidence(confidence)) return null;
  return { kind, value, confidence };
}
