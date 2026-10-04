/**
 * Stateless HMAC-signed tokens for proposal integrity. Web Crypto only
 * (`crypto.subtle`, `TextEncoder`/`TextDecoder`), so this runs unchanged in
 * both Node (tests) and Deno (Edge Functions).
 *
 * Important scope note: in this project, the orchestration layer never
 * performs the actual financial-record write itself — see
 * supabase/functions/ai-orchestrate/index.ts's doc comment. The *existing*
 * manual-entry screens (already reviewed, already RLS-protected) are the
 * only write path, and the human tapping "Save" there is the real
 * consequential-action confirmation. This token exists so a proposal can
 * be proven untampered and unexpired if a future UI wants to pre-fill that
 * existing screen from one — it is not, today, a server-side gate on any
 * write.
 */

export interface ConfirmationPayload {
  userId: string;
  action: string;
  /** SHA-256 hex digest of the exact proposed values — see `hashPayload`. */
  payloadHash: string;
  issuedAt: number;
  expiresAt: number;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error('invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** SHA-256 hex digest of a JSON-serialized value — used to bind a token to exact proposed values. */
export async function hashPayload(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

export async function signConfirmationToken(
  payload: ConfirmationPayload,
  secret: string
): Promise<string> {
  const payloadHex = toHex(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadHex));
  return `${payloadHex}.${toHex(new Uint8Array(signature))}`;
}

export type ConfirmationVerifyResult =
  | { valid: true; payload: ConfirmationPayload }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export async function verifyConfirmationToken(
  token: string,
  secret: string,
  now: number
): Promise<ConfirmationVerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadHex, signatureHex] = parts;

  let payload: ConfirmationPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromHex(payloadHex)));
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  let providedSignature: Uint8Array;
  try {
    providedSignature = fromHex(signatureHex);
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  const key = await hmacKey(secret);
  const expectedSignature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadHex))
  );
  if (!constantTimeEqual(expectedSignature, providedSignature)) {
    return { valid: false, reason: 'bad_signature' };
  }

  if (now > payload.expiresAt) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, payload };
}
