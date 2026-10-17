/**
 * Pattern-based defense-in-depth. Strips common sensitive identifiers
 * (card/account numbers, SSNs, emails) before text reaches a log line, and
 * flags likely prompt-injection phrasing before text reaches any model.
 * This is NOT a substitute for only ever sending small, derived state in
 * the first place — see `workflows.ts` for the actual allowlisted criteria
 * sent to Jev.
 *
 * Regexes are constructed fresh per call rather than reused as module-level
 * globals — a shared global-flag RegExp's `lastIndex` persists between
 * `.test()` calls and silently alternates true/false across invocations,
 * which would make detection flicker in production. Fresh instances avoid
 * that bug entirely at a negligible cost for the short strings this
 * handles.
 */

const CARD_OR_ACCOUNT_NUMBER_PATTERN = '\\b\\d[\\d -]{10,22}\\d\\b';
const SSN_PATTERN = '\\b\\d{3}-\\d{2}-\\d{4}\\b';
const EMAIL_PATTERN = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';

export interface SensitivePatternFlags {
  hasCardOrAccountNumber: boolean;
  hasSsn: boolean;
  hasEmail: boolean;
}

export function detectSensitivePatterns(text: string): SensitivePatternFlags {
  return {
    hasCardOrAccountNumber: new RegExp(CARD_OR_ACCOUNT_NUMBER_PATTERN).test(text),
    hasSsn: new RegExp(SSN_PATTERN).test(text),
    hasEmail: new RegExp(EMAIL_PATTERN).test(text),
  };
}

export function redactSensitivePatterns(text: string): string {
  return text
    .replace(new RegExp(CARD_OR_ACCOUNT_NUMBER_PATTERN, 'g'), '[redacted-number]')
    .replace(new RegExp(SSN_PATTERN, 'g'), '[redacted-ssn]')
    .replace(new RegExp(EMAIL_PATTERN, 'g'), '[redacted-email]');
}

/**
 * A deliberately simple, deterministic pre-filter for common prompt
 * injection phrasing — NOT a replacement for Jev's own
 * `possible_prompt_injection` safety classification, which is
 * probabilistic and catches far more than this fixed phrase list. This
 * exists so the most obvious attempts never even reach a model call: cheap
 * to run, zero false negatives for the exact phrases it lists, and errs
 * toward over-flagging (a false positive here just means "ask the user to
 * rephrase," never a blocked legitimate request that can't be retried).
 */
const INJECTION_PHRASES = [
  'ignore previous instructions',
  'ignore all previous instructions',
  'ignore the above',
  'disregard previous instructions',
  'you are now',
  'new instructions:',
  'system prompt',
  'reveal your instructions',
  'print your system prompt',
  'act as if',
  'do anything now',
  'jailbreak',
];

export function looksLikePromptInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return INJECTION_PHRASES.some((phrase) => lower.includes(phrase));
}
