import type { TypedSupabaseClient } from '../client';

/**
 * Thrown when an Edge Function call fails. `code` is set for known error
 * shapes ('usage_limit', plus the Budget Buddy voice codes listed on
 * transcribeBuddyAudio) so UI can branch on it — e.g. show an upgrade
 * prompt instead of a generic error banner.
 */
export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

/**
 * Every Edge Function in this project returns a JSON body of either
 * `{ ...result }` on success or `{ error: string, code?: string }` on
 * failure (see supabase/functions/_shared/cors.ts's jsonResponse + each
 * function's catch block). This unwraps that convention once, so each
 * wrapper below is just "what shape does this specific function return."
 */
async function invokeEdgeFunction<T>(
  client: TypedSupabaseClient,
  name: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const { data, error } = await client.functions.invoke(name, signal ? { body, signal } : { body });

  if (error) {
    // FunctionsHttpError carries the actual Response on `.context` — the
    // generic `error.message` from supabase-js is just "Edge Function
    // returned a non-2xx status code", not useful to show a user.
    const context = (error as { context?: Response }).context;
    if (context) {
      // Only the JSON parse itself should be caught here — a parse failure
      // means the body wasn't JSON, so fall through to the generic message
      // below. Throwing our own EdgeFunctionError from inside this try
      // would be caught by its own catch, silently discarding the parsed
      // message (a real bug this comment exists to warn against re-adding).
      let parsed: { error?: string; code?: string } | undefined;
      try {
        parsed = await context.json();
      } catch {
        parsed = undefined;
      }
      if (parsed) {
        throw new EdgeFunctionError(parsed.error ?? error.message, parsed.code);
      }
    }
    throw new EdgeFunctionError(error.message);
  }

  if (data?.error) {
    throw new EdgeFunctionError(data.error, data.code);
  }

  return data as T;
}

export interface ReceiptExtraction {
  store_label: string | null;
  purchased_on: string | null;
  items: { label: string; category: string | null; price_cents: number; quantity: number }[];
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
}

export async function scanReceipt(
  client: TypedSupabaseClient,
  imageBase64: string,
  mediaType: string
): Promise<ReceiptExtraction> {
  const { extraction } = await invokeEdgeFunction<{ extraction: ReceiptExtraction }>(
    client,
    'receipt-scan',
    { imageBase64, mediaType }
  );
  return extraction;
}

export interface PantryExtraction {
  visible_items: string[];
  running_low_or_missing: string[];
}

export async function scanPantry(
  client: TypedSupabaseClient,
  imageBase64: string,
  mediaType: string
): Promise<PantryExtraction> {
  const { extraction } = await invokeEdgeFunction<{ extraction: PantryExtraction }>(
    client,
    'pantry-scan',
    { imageBase64, mediaType }
  );
  return extraction;
}

export interface BudgetBuddyHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BudgetBuddyMessageOptions {
  /** `'voice'` for a spoken message — the reply comes back short and ready to read aloud. */
  mode?: 'voice';
  /** Aborting stops the request locally and cancels the upstream call where the server supports it. */
  signal?: AbortSignal;
}

export async function sendBudgetBuddyMessage(
  client: TypedSupabaseClient,
  message: string,
  history: BudgetBuddyHistoryMessage[],
  options: BudgetBuddyMessageOptions = {}
): Promise<string> {
  const { reply } = await invokeEdgeFunction<{ reply: string }>(
    client,
    'budget-buddy-chat',
    options.mode ? { message, history, mode: options.mode } : { message, history },
    options.signal
  );
  return reply;
}

/** One kind of voice call's monthly allowance for the caller's plan. Never unlimited. */
export interface BuddyVoiceAllowance {
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Whether Budget Buddy voice is switched on server-side and what the
 * caller's plan allows this month. `enabled: false` means "hide the voice
 * controls" — typed chat is unaffected either way.
 */
export type BuddyVoiceStatus =
  | { enabled: false }
  | {
      enabled: true;
      maxRecordingSeconds: number;
      /** Spoken messages (speech-to-text). */
      transcription: BuddyVoiceAllowance;
      /** Replies read aloud (text-to-speech). */
      speech: BuddyVoiceAllowance;
    };

export async function getBuddyVoiceStatus(
  client: TypedSupabaseClient,
  signal?: AbortSignal
): Promise<BuddyVoiceStatus> {
  return invokeEdgeFunction<BuddyVoiceStatus>(
    client,
    'budget-buddy-voice',
    { action: 'status' },
    signal
  );
}

/**
 * Sends one recording for transcription. The audio is processed in memory
 * server-side and never stored. `requestId` must be unique per tap: the
 * server refuses a repeat (`code: 'duplicate_request'`) rather than paying
 * for the same recording twice. Failures throw EdgeFunctionError with a
 * customer-ready message and a `code` such as 'usage_limit',
 * 'voice_not_in_plan', 'rate_limited', 'no_speech', or 'provider_timeout'.
 */
export async function transcribeBuddyAudio(
  client: TypedSupabaseClient,
  args: { requestId: string; audioBase64: string; durationMs: number },
  signal?: AbortSignal
): Promise<{ transcript: string; remaining: number }> {
  return invokeEdgeFunction(
    client,
    'budget-buddy-voice',
    { action: 'transcribe', ...args },
    signal
  );
}

/**
 * Generates the spoken version of a Budget Buddy reply. `audioBase64` is a
 * complete audio file of type `mimeType`; `truncated` is true when the
 * reply was longer than the server's spoken-length limit (the written reply
 * is always the full one). Same error contract as transcribeBuddyAudio.
 */
export async function synthesizeBuddySpeech(
  client: TypedSupabaseClient,
  args: { requestId: string; text: string },
  signal?: AbortSignal
): Promise<{ audioBase64: string; mimeType: string; truncated: boolean; remaining: number }> {
  return invokeEdgeFunction(client, 'budget-buddy-voice', { action: 'speak', ...args }, signal);
}

/**
 * Jev's typed intent classification for one piece of voice/text input,
 * returned in observation mode only — this NEVER saves anything and NEVER
 * calls Claude. `status: 'disabled' | 'fallback'` means "fall back to
 * manual entry," not an error: the caller should treat those the same way
 * it would if this function didn't exist at all. `status: 'blocked'` means
 * the deterministic safety pre-filter caught the input before any model
 * call. Not wired into any screen yet — this is the typed client entry
 * point a future UI can call once there's a voice/text quick-add surface.
 */
export type RouteIntentResult =
  | {
      status: 'recommendation';
      requestId: string;
      intent: string;
      confidence: number;
      band: 'low' | 'medium' | 'high';
      action: 'clarify' | 'suggest' | 'preselect';
    }
  | { status: 'blocked'; reason: string }
  | { status: 'disabled' }
  | { status: 'fallback'; reason: string };

export async function routeIntent(
  client: TypedSupabaseClient,
  text: string
): Promise<RouteIntentResult> {
  return invokeEdgeFunction<RouteIntentResult>(client, 'intent-router', { text });
}

/**
 * The complex-task orchestration loop's result for one proposed bill
 * payment, extracted from free text via Claude, validated deterministically
 * (bill match, amount, date), and quality-checked by Jev — up to 3 attempts.
 * This NEVER saves anything. `status: 'proposal'` means the loop produced a
 * reviewable proposal (`needsConfirmation` is always true for this action,
 * since recording a payment is consequential) that the UI should pre-fill
 * into the EXISTING record-bill-payment screen for the user to review, edit,
 * and save themselves — the existing manual save flow is the real write
 * path and the real confirmation, unchanged by this function.
 * `status: 'needs_human_review' | 'blocked' | 'disabled'` all mean the same
 * thing to the UI: fall back to the existing manual-entry screen with
 * nothing pre-filled. Not wired into any screen yet.
 */
export type ProposeBillPaymentResult =
  | {
      status: 'proposal';
      requestId: string;
      needsConfirmation: boolean;
      proposal: {
        billId: string | null;
        billMatch: 'exact' | 'fuzzy' | 'none';
        amountCents: number | null;
        paidOn: string | null;
      };
      confirmationToken: string;
      expiresAt: number;
    }
  | { status: 'needs_human_review'; requestId?: string; reason: string }
  | { status: 'blocked'; reason: string }
  | { status: 'disabled' };

export async function proposeBillPayment(
  client: TypedSupabaseClient,
  text: string
): Promise<ProposeBillPaymentResult> {
  return invokeEdgeFunction<ProposeBillPaymentResult>(client, 'ai-orchestrate', { text });
}

/**
 * Deletes the caller's own account and every row that depends on it —
 * irreversible. The caller (UI) is responsible for getting explicit
 * confirmation before invoking this; nothing here prompts.
 */
export async function deleteAccount(client: TypedSupabaseClient): Promise<void> {
  await invokeEdgeFunction<{ deleted: true }>(client, 'delete-account', {});
}

/**
 * Returns a Stripe Checkout URL to redirect the browser to. The client
 * names a plan tier + billing interval, never a raw Stripe Price ID —
 * those live only in server-side config (see
 * supabase/functions/_shared/stripe-config.ts).
 */
export async function createCheckoutSession(
  client: TypedSupabaseClient,
  args: {
    plan: 'guided' | 'budgetBuddy';
    interval: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
  }
): Promise<string> {
  const { url } = await invokeEdgeFunction<{ url: string }>(client, 'stripe-checkout', args);
  return url;
}

/** Returns a Stripe Billing Portal URL to redirect the browser to. */
export async function createPortalSession(
  client: TypedSupabaseClient,
  returnUrl: string
): Promise<string> {
  const { url } = await invokeEdgeFunction<{ url: string }>(client, 'stripe-portal', { returnUrl });
  return url;
}
