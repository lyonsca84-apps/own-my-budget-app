// Voice/text intent router — the first working Jev integration, run
// strictly in observation mode. Jev only classifies; it never calculates,
// parses dates, or touches the database. This function NEVER writes
// anything and NEVER calls Claude — it returns a typed recommendation the
// client may show the user, who must still go through the existing manual
// entry / confirmation screens for anything consequential. If Jev is
// disabled, erroring, or returns anything invalid, this falls back to a
// safe "use manual entry" response rather than guessing — the existing
// manual-entry experience keeps working unconditionally either way.
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { assertUnderLimit, recordUsage, getPlanTier, UsageLimitError } from '../_shared/usage.ts';
import { isJevVoiceRoutingEnabled } from '../_shared/flags.ts';
import { looksLikePromptInjection, redactSensitivePatterns } from '../_shared/redact.ts';
import { callJevDecision } from '../_shared/jev-client.ts';
import {
  applyConfidencePolicy,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from '../_shared/confidence-policy.ts';

const MAX_TEXT_LENGTH = 500;

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);

    if (!isJevVoiceRoutingEnabled()) {
      return jsonResponse({ status: 'disabled' });
    }

    const body = await req.json();
    const text: unknown = body?.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      return jsonResponse({ error: 'text is required.' }, 400);
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return jsonResponse({ error: 'text is too long.' }, 400);
    }

    // Deterministic, zero-cost pre-filter before any model call — see
    // redact.ts's doc comment on why this is defense-in-depth, not a
    // substitute for Jev's own (future) safety_classification workflow.
    if (looksLikePromptInjection(text)) {
      return jsonResponse({ status: 'blocked', reason: 'possible_prompt_injection' });
    }

    const admin = createAdminClient();
    const planTier = await getPlanTier(admin, userId);
    await assertUnderLimit(admin, userId, 'jevDecision', planTier);

    const requestId = crypto.randomUUID();
    const redactedText = redactSensitivePatterns(text);

    const decision = await callJevDecision({
      workflow: 'user_intent',
      input: redactedText,
      requestId,
    });

    if (!decision.ok) {
      // Every failure path (disabled upstream, circuit open, timeout,
      // invalid response, rate limited, network/http error) collapses to
      // the same safe instruction: fall back to manual entry. The reason
      // is returned for client-side logging/debugging only, never surfaced
      // as if it were a real classification.
      return jsonResponse({ status: 'fallback', reason: decision.reason });
    }

    await recordUsage(admin, userId, 'jevDecision', planTier);

    const policy = applyConfidencePolicy(
      decision.confidence,
      DEFAULT_CONFIDENCE_THRESHOLDS.user_intent,
      // record_bill_payment and similar intents are only ever a
      // *recommendation* at this stage — nothing is written here — so this
      // is never treated as consequential by the router itself. The future
      // tool that actually performs a write (Phase 2) applies its own,
      // always-true confirmation requirement at that point.
      false
    );

    return jsonResponse({
      status: 'recommendation',
      requestId,
      intent: decision.value,
      confidence: decision.confidence,
      band: policy.band,
      action: policy.action,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof UsageLimitError) {
      return jsonResponse(
        {
          error: `You've used all your AI routing actions for this ${error.period === 'monthly' ? 'month' : 'plan'}.`,
          code: 'usage_limit',
        },
        403
      );
    }
    console.error('intent-router error:', error);
    // Fail open to manual entry rather than a hard error, per the project's
    // "AI unavailable never blocks the existing manual experience" rule —
    // but auth/validation failures above still return their real status.
    return jsonResponse({ status: 'fallback', reason: 'unknown_error' });
  }
});
