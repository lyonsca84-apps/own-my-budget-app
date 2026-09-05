import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Verifies the caller's JWT (from the Authorization header the client SDK
 * sends automatically on functions.invoke) and returns their user id.
 * This is the ONLY sanctioned way these functions learn who is calling —
 * never accept a user_id from the request body, since that would let any
 * caller act as any other user.
 */
export async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthError('Missing Authorization header.');
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in the function environment.');
  }

  // A plain anon-key client with the caller's JWT forwarded — getUser()
  // verifies the token's signature against Supabase Auth, it does not just
  // decode it client-side.
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new AuthError('Invalid or expired session.');
  }
  return data.user.id;
}

export class AuthError extends Error {}
