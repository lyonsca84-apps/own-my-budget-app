// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/redact.ts — see jev-decisions.ts for why.
// Regexes are constructed fresh per call rather than reused as module-level
// globals, since a shared global-flag RegExp's `lastIndex` persists between
// `.test()` calls and would make detection flicker across requests.

const CARD_OR_ACCOUNT_NUMBER_PATTERN = '\\b\\d[\\d -]{10,22}\\d\\b';
const SSN_PATTERN = '\\b\\d{3}-\\d{2}-\\d{4}\\b';
const EMAIL_PATTERN = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';

export function redactSensitivePatterns(text: string): string {
  return text
    .replace(new RegExp(CARD_OR_ACCOUNT_NUMBER_PATTERN, 'g'), '[redacted-number]')
    .replace(new RegExp(SSN_PATTERN, 'g'), '[redacted-ssn]')
    .replace(new RegExp(EMAIL_PATTERN, 'g'), '[redacted-email]');
}

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
