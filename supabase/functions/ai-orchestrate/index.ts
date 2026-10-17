// The complex-task orchestration loop: Claude proposes -> protected
// (read-only) tool looks up a match -> Jev evaluates against narrow
// criteria -> Claude revises, up to AI_ORCHESTRATOR_MAX_LOOPS total
// attempts (default 3). Currently implements exactly one workflow:
// extracting a proposed bill payment from free text, matching the original
// task brief's worked example ("I paid Georgia Power $75 yesterday.").
//
// CRITICAL SCOPE NOTE: this function NEVER writes a financial record. It
// only ever returns a proposal (or a review-required result) for a human
// to look at. The actual save continues to go through the existing,
// unmodified, RLS-protected manual-entry path (recordBillPayment, called
// by the client after a human reviews the pre-filled screen and taps
// Save) — that existing human-reviewed tap IS the "visible user
// confirmation before creating a financial record" this project's rules
// require. Building a second, AI-triggered write path was deliberately
// out of scope for this phase; see docs/ai-orchestrator-setup.md.
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { assertUnderLimit, recordUsage, getPlanTier, UsageLimitError } from '../_shared/usage.ts';
import { isJevOrchestratorEnabled, getMaxOrchestratorLoops } from '../_shared/flags.ts';
import { looksLikePromptInjection } from '../_shared/redact.ts';
import { callJevDecision } from '../_shared/jev-client.ts';
import {
  applyConfidencePolicy,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from '../_shared/confidence-policy.ts';
import { decideNextLoopAction, type LoopSignal } from '../_shared/loop-controller.ts';
import { extractBillPayment, type BillPaymentExtraction } from '../_shared/claude-client.ts';
import { parseSpokenDate } from '../_shared/spoken-date.ts';
import { matchBillName, type KnownBill } from '../_shared/bill-match.ts';
import { signConfirmationToken, hashPayload } from '../_shared/confirmation-token.ts';

const MAX_TEXT_LENGTH = 500;
const MAX_AMOUNT_CENTS = 100_000_00; // $100,000 — a sanity cap, not a real limit
const TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const EMPTY_EXTRACTION: BillPaymentExtraction = {
  bill_name: null,
  amount_dollars: null,
  spoken_date: null,
};

interface DerivedSignals {
  billMatchKind: 'exact' | 'fuzzy' | 'none';
  billId: string | null;
  amountValid: boolean;
  amountCents: number | null;
  dateValid: boolean;
  isoDate: string | null;
  dateIsFuture: boolean;
}

function deriveSignals(
  extraction: BillPaymentExtraction,
  knownBills: KnownBill[],
  now: Date
): DerivedSignals {
  const match = matchBillName(extraction.bill_name ?? '', knownBills);

  const amountCents =
    extraction.amount_dollars !== null && Number.isFinite(extraction.amount_dollars)
      ? Math.round(extraction.amount_dollars * 100)
      : null;
  const amountValid = amountCents !== null && amountCents > 0 && amountCents < MAX_AMOUNT_CENTS;

  const parsedDate =
    extraction.spoken_date !== null ? parseSpokenDate(extraction.spoken_date, now) : null;
  const dateValid = parsedDate !== null;
  const todayIso = parseSpokenDate('today', now)!.isoDate;
  const dateIsFuture = parsedDate !== null && parsedDate.isoDate > todayIso;

  return {
    billMatchKind: match.matchKind,
    billId: match.billId,
    amountValid,
    amountCents,
    dateValid,
    isoDate: parsedDate?.isoDate ?? null,
    dateIsFuture,
  };
}

function signalsToJevInput(
  signals: DerivedSignals,
  hasBillName: boolean,
  hasAmount: boolean,
  hasDate: boolean
): string {
  return [
    `bill_match: ${signals.billMatchKind}`,
    `bill_name_present: ${hasBillName}`,
    `amount_present: ${hasAmount}`,
    `amount_valid: ${signals.amountValid}`,
    `date_present: ${hasDate}`,
    `date_valid: ${signals.dateValid}`,
    `date_is_future: ${signals.dateIsFuture}`,
  ].join('; ');
}

function buildRevisionReason(signals: DerivedSignals, extraction: BillPaymentExtraction): string {
  const parts: string[] = [];
  if (signals.billMatchKind === 'none') parts.push('the bill name did not match any bill on file');
  if (extraction.amount_dollars === null || !signals.amountValid) {
    parts.push('the amount was missing or invalid');
  }
  if (extraction.spoken_date === null || !signals.dateValid) {
    parts.push('the date was missing or could not be parsed');
  }
  return parts.length > 0
    ? parts.join('; ')
    : 'the proposal needs a cleaner extraction from the same text';
}

/**
 * Explicit field allowlist — mirrors packages/ai-orchestrator's
 * OrchestrationLogEntry shape. Never spreads a raw request/response, so a
 * prompt, extracted bill name/amount, or key can never reach a log line.
 */
function logOrchestration(fields: {
  requestId: string;
  userId: string;
  iteration: number;
  maxLoops: number;
  jevDecision?: string;
  jevConfidence?: number;
  status: 'pass' | 'fail' | 'unclear' | 'fallback';
}): void {
  console.log(
    JSON.stringify({
      event: 'ai_orchestrate',
      requestId: fields.requestId,
      userId: fields.userId,
      workflowName: 'record_bill_payment_extraction',
      model: 'claude-sonnet-5+typesafe/jev-1.13',
      decision: fields.jevDecision,
      confidence: fields.jevConfidence,
      iteration: fields.iteration,
      maxLoops: fields.maxLoops,
      status: fields.status,
    })
  );
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);

    if (!isJevOrchestratorEnabled()) {
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
    if (looksLikePromptInjection(text)) {
      return jsonResponse({ status: 'blocked', reason: 'possible_prompt_injection' });
    }

    const admin = createAdminClient();
    const planTier = await getPlanTier(admin, userId);

    const { data: bills, error: billsError } = await admin
      .from('bills')
      .select('id, label')
      .eq('user_id', userId)
      .is('archived_at', null);
    if (billsError) throw billsError;
    const knownBills: KnownBill[] = bills;

    const requestId = crypto.randomUUID();
    const maxLoops = getMaxOrchestratorLoops();
    const now = new Date();

    let iteration = 0;
    let lastExtraction: BillPaymentExtraction = EMPTY_EXTRACTION;
    let claudeCallSucceeded = false;
    let revision: { priorAttempt: BillPaymentExtraction; reason: string } | undefined;

    while (iteration < maxLoops) {
      iteration++;

      const extractionResult = await extractBillPayment(text, revision);
      if (!extractionResult.ok) {
        // Claude itself failed (timeout/network/invalid JSON/not
        // configured) — resolve immediately to review-required rather than
        // burning remaining loop attempts on a dependency that's down.
        if (claudeCallSucceeded) {
          await recordUsage(admin, userId, 'aiOrchestration', planTier);
        }
        logOrchestration({ requestId, userId, iteration, maxLoops, status: 'fallback' });
        return jsonResponse({
          status: 'needs_human_review',
          requestId,
          reason: 'claude_unavailable',
        });
      }

      claudeCallSucceeded = true;
      lastExtraction = extractionResult.attempt;
      const signals = deriveSignals(lastExtraction, knownBills, now);
      const jevInput = signalsToJevInput(
        signals,
        lastExtraction.bill_name !== null,
        lastExtraction.amount_dollars !== null,
        lastExtraction.spoken_date !== null
      );

      await assertUnderLimit(admin, userId, 'jevDecision', planTier);
      const jevResult = await callJevDecision({
        workflow: 'record_bill_payment_evaluation',
        input: jevInput,
        requestId,
      });

      let loopSignal: LoopSignal;
      if (!jevResult.ok) {
        loopSignal = 'error';
      } else {
        await recordUsage(admin, userId, 'jevDecision', planTier);
        const policy = applyConfidencePolicy(
          jevResult.confidence,
          DEFAULT_CONFIDENCE_THRESHOLDS.workflow_status,
          false
        );
        loopSignal = policy.band === 'low' ? 'low_confidence' : (jevResult.value as LoopSignal);
      }

      const action = decideNextLoopAction({ iteration, maxLoops }, loopSignal);
      logOrchestration({
        requestId,
        userId,
        iteration,
        maxLoops,
        jevDecision: jevResult.ok ? jevResult.value : undefined,
        jevConfidence: jevResult.ok ? jevResult.confidence : undefined,
        status:
          action.action === 'pass'
            ? 'pass'
            : action.action === 'revise' || action.action === 'needs_user_confirmation'
              ? 'unclear'
              : 'fail',
      });

      if (action.action === 'revise') {
        revision = {
          priorAttempt: lastExtraction,
          reason: buildRevisionReason(signals, lastExtraction),
        };
        continue;
      }

      await recordUsage(admin, userId, 'aiOrchestration', planTier);

      if (action.action === 'pass' || action.action === 'needs_user_confirmation') {
        const proposalPayload = {
          billId: signals.billId,
          amountCents: signals.amountCents,
          paidOn: signals.isoDate,
        };
        const payloadHash = await hashPayload(proposalPayload);
        const issuedAt = Date.now();
        const confirmationToken = await signConfirmationToken(
          {
            userId,
            action: 'record_bill_payment',
            payloadHash,
            issuedAt,
            expiresAt: issuedAt + TOKEN_LIFETIME_MS,
          },
          // Reuses the service-role key already injected into every Edge
          // Function's environment — no new secret to configure for
          // something that doesn't gate a write yet (see this file's top
          // doc comment). Never logged, never returned to the client.
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        return jsonResponse({
          status: 'proposal',
          requestId,
          needsConfirmation: action.action === 'needs_user_confirmation',
          proposal: {
            billId: signals.billId,
            billMatch: signals.billMatchKind,
            amountCents: signals.amountCents,
            paidOn: signals.isoDate,
          },
          confirmationToken,
          expiresAt: issuedAt + TOKEN_LIFETIME_MS,
        });
      }

      // needs_human_review or max_loops_reached — never guess, never save.
      const reason = action.action === 'max_loops_reached' ? 'max_loops_reached' : action.reason;
      return jsonResponse({ status: 'needs_human_review', requestId, reason });
    }

    // Unreachable in practice (every branch inside the loop above returns),
    // kept only so TypeScript is satisfied every path returns.
    return jsonResponse({ status: 'needs_human_review', requestId, reason: 'max_loops_reached' });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof UsageLimitError) {
      return jsonResponse(
        {
          error: `You've used all your AI orchestration actions for this ${error.period === 'monthly' ? 'month' : 'plan'}.`,
          code: 'usage_limit',
        },
        403
      );
    }
    console.error('ai-orchestrate error:', error);
    return jsonResponse({ status: 'needs_human_review', reason: 'unknown_error' });
  }
});
