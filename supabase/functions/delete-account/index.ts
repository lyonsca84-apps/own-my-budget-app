// Deletes the caller's own account and every row that depends on it.
// Server-side only — deleting an auth.users row requires the Admin API,
// which needs the service-role key and is never exposed to the client.
// The cascade is entirely schema-driven: profiles.id references
// auth.users(id) on delete cascade, and every other table references
// profiles(id) on delete cascade (see supabase/migrations), so this one
// admin.deleteUser call is sufficient — there is no per-table cleanup to
// get wrong or forget.
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);
    const admin = createAdminClient();

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return jsonResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    console.error('delete-account error:', error);
    return jsonResponse(
      { error: 'Something went wrong deleting your account. Nothing was changed.' },
      500
    );
  }
});
