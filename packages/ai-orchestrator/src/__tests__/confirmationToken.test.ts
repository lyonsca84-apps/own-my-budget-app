import { hashPayload, signConfirmationToken, verifyConfirmationToken } from '../confirmationToken';

const SECRET = 'test-secret-do-not-use-in-prod';

async function samplePayload(overrides: Partial<Parameters<typeof signConfirmationToken>[0]> = {}) {
  return {
    userId: 'user-123',
    action: 'record_bill_payment',
    payloadHash: await hashPayload({ billId: 'bill-1', amountCents: 7500, paidOn: '2026-10-03' }),
    issuedAt: 1000,
    expiresAt: 1000 + 15 * 60 * 1000,
    ...overrides,
  };
}

describe('hashPayload', () => {
  it('produces the same hash for the same value', async () => {
    const a = await hashPayload({ x: 1, y: 'two' });
    const b = await hashPayload({ x: 1, y: 'two' });
    expect(a).toBe(b);
  });

  it('produces a different hash for a different value', async () => {
    const a = await hashPayload({ amountCents: 7500 });
    const b = await hashPayload({ amountCents: 7501 });
    expect(a).not.toBe(b);
  });
});

describe('sign + verify round trip', () => {
  it('verifies a freshly signed token as valid, with the original payload intact', async () => {
    const payload = await samplePayload();
    const token = await signConfirmationToken(payload, SECRET);
    const result = await verifyConfirmationToken(token, SECRET, payload.issuedAt);
    expect(result).toEqual({ valid: true, payload });
  });

  it('is valid right up to (and including) its expiry instant', async () => {
    const payload = await samplePayload();
    const token = await signConfirmationToken(payload, SECRET);
    const result = await verifyConfirmationToken(token, SECRET, payload.expiresAt);
    expect(result.valid).toBe(true);
  });
});

describe('verifyConfirmationToken — tampering and expiry', () => {
  it('rejects a token signed with a different secret', async () => {
    const payload = await samplePayload();
    const token = await signConfirmationToken(payload, SECRET);
    const result = await verifyConfirmationToken(token, 'a-different-secret', payload.issuedAt);
    expect(result).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects a token whose payload was tampered with after signing', async () => {
    const payload = await samplePayload();
    const token = await signConfirmationToken(payload, SECRET);
    const [, signatureHex] = token.split('.');
    const tamperedPayloadHex = Buffer.from(
      JSON.stringify({ ...payload, action: 'delete_everything' })
    ).toString('hex');
    const tamperedToken = `${tamperedPayloadHex}.${signatureHex}`;
    const result = await verifyConfirmationToken(tamperedToken, SECRET, payload.issuedAt);
    expect(result).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects an expired token', async () => {
    const payload = await samplePayload();
    const token = await signConfirmationToken(payload, SECRET);
    const result = await verifyConfirmationToken(token, SECRET, payload.expiresAt + 1);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects a malformed token (no separator)', async () => {
    const result = await verifyConfirmationToken('not-a-real-token', SECRET, 0);
    expect(result).toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects a malformed token (invalid hex)', async () => {
    const result = await verifyConfirmationToken('zzzz.zzzz', SECRET, 0);
    expect(result).toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects an empty string', async () => {
    const result = await verifyConfirmationToken('', SECRET, 0);
    expect(result.valid).toBe(false);
  });
});
