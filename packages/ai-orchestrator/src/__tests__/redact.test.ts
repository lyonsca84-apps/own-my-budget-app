import {
  detectSensitivePatterns,
  looksLikePromptInjection,
  redactSensitivePatterns,
} from '../redact';
import { PHRASE_FIXTURES } from './fixtures';

describe('detectSensitivePatterns', () => {
  it('flags a card number', () => {
    expect(detectSensitivePatterns('My card is 4111 1111 1111 1111').hasCardOrAccountNumber).toBe(
      true
    );
  });

  it('flags a bare account number', () => {
    expect(detectSensitivePatterns('account 123456789012 please').hasCardOrAccountNumber).toBe(
      true
    );
  });

  it('flags an SSN', () => {
    expect(detectSensitivePatterns('ssn is 123-45-6789').hasSsn).toBe(true);
  });

  it('flags an email address', () => {
    expect(detectSensitivePatterns('reach me at jane.doe@example.com').hasEmail).toBe(true);
  });

  it('does not flag ordinary budgeting text', () => {
    const flags = detectSensitivePatterns('I paid Georgia Power $75 yesterday.');
    expect(flags).toEqual({ hasCardOrAccountNumber: false, hasSsn: false, hasEmail: false });
  });

  it('does not flag a short dollar amount or a plain date-like number', () => {
    // Regression guard: short numeric amounts (money, quantities) must not
    // trip the card/account-number detector — only long digit runs should.
    const flags = detectSensitivePatterns('I spent 42 dollars on the 3rd.');
    expect(flags.hasCardOrAccountNumber).toBe(false);
  });

  it('is stable across repeated calls on the same input (no shared regex state)', () => {
    const text = 'My card is 4111 1111 1111 1111';
    expect(detectSensitivePatterns(text).hasCardOrAccountNumber).toBe(true);
    expect(detectSensitivePatterns(text).hasCardOrAccountNumber).toBe(true);
    expect(detectSensitivePatterns(text).hasCardOrAccountNumber).toBe(true);
  });

  it('flags every fixture phrase tagged containsSensitive, and none of the others', () => {
    for (const fixture of PHRASE_FIXTURES) {
      const flags = detectSensitivePatterns(fixture.text);
      const flaggedAny = flags.hasCardOrAccountNumber || flags.hasSsn || flags.hasEmail;
      expect(flaggedAny).toBe(Boolean(fixture.containsSensitive));
    }
  });
});

describe('redactSensitivePatterns', () => {
  it('replaces a card number with a placeholder', () => {
    expect(redactSensitivePatterns('card 4111 1111 1111 1111 exp 12/29')).toContain(
      '[redacted-number]'
    );
  });

  it('replaces an SSN and an email in the same string', () => {
    const result = redactSensitivePatterns('ssn 123-45-6789, email jane@example.com');
    expect(result).toContain('[redacted-ssn]');
    expect(result).toContain('[redacted-email]');
    expect(result).not.toContain('123-45-6789');
    expect(result).not.toContain('jane@example.com');
  });

  it('leaves ordinary text untouched', () => {
    const text = 'I paid Georgia Power $75 yesterday.';
    expect(redactSensitivePatterns(text)).toBe(text);
  });

  it('is idempotent and stable across repeated calls', () => {
    const text = 'account 123456789012';
    const once = redactSensitivePatterns(text);
    const twice = redactSensitivePatterns(text);
    expect(once).toBe(twice);
  });
});

describe('looksLikePromptInjection', () => {
  it('flags every fixture phrase tagged isInjection', () => {
    for (const fixture of PHRASE_FIXTURES.filter((f) => f.isInjection)) {
      expect(looksLikePromptInjection(fixture.text)).toBe(true);
    }
  });

  it('does not flag ordinary budgeting phrases', () => {
    for (const fixture of PHRASE_FIXTURES.filter((f) => !f.isInjection)) {
      expect(looksLikePromptInjection(fixture.text)).toBe(false);
    }
  });

  it('is case-insensitive', () => {
    expect(looksLikePromptInjection('IGNORE PREVIOUS INSTRUCTIONS')).toBe(true);
  });
});
