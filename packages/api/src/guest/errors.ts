/**
 * Mirrors supabase-js's PostgrestError shape (`message`, `details`, `hint`,
 * `code`) so UI code that inspects `error.code` — e.g. the Budget view's
 * `isMissingTable` — behaves the same against the in-memory client.
 */
export class GuestPostgrestError extends Error {
  code: string;
  details: string | null;
  hint: string | null;
  /** HTTP status PostgREST would have answered with (informational). */
  status: number;

  constructor(
    message: string,
    code: string,
    options: { details?: string | null; hint?: string | null; status?: number } = {}
  ) {
    super(message);
    this.name = 'PostgrestError';
    this.code = code;
    this.details = options.details ?? null;
    this.hint = options.hint ?? null;
    this.status = options.status ?? 400;
  }

  toJSON() {
    return { message: this.message, details: this.details, hint: this.hint, code: this.code };
  }
}

export const pgError = (
  message: string,
  code: string,
  options?: { details?: string | null; hint?: string | null; status?: number }
) => new GuestPostgrestError(message, code, options);
