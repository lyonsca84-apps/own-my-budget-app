import type { TypedSupabaseClient } from '../client';

/**
 * Thrown when an Edge Function call fails. `code` is set for known error
 * shapes (currently just 'usage_limit') so UI can branch on it — e.g. show
 * an upgrade prompt instead of a generic error banner.
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
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await client.functions.invoke(name, { body });

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

export async function sendBudgetBuddyMessage(
  client: TypedSupabaseClient,
  message: string,
  history: BudgetBuddyHistoryMessage[]
): Promise<string> {
  const { reply } = await invokeEdgeFunction<{ reply: string }>(client, 'budget-buddy-chat', {
    message,
    history,
  });
  return reply;
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
