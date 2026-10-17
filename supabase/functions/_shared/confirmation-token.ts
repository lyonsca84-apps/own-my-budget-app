// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/confirmationToken.ts — see jev-decisions.ts
// for why, and that file's doc comment for why this is proposal-integrity
// metadata, not a server-side write gate, in this phase.

export interface ConfirmationPayload {
  userId: string;
  action: string;
  payloadHash: string;
  issuedAt: number;
  expiresAt: number;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
