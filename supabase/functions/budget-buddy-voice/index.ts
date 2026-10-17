// Budget Buddy voice: turn-based tap-to-talk. This function only does the
// two audio steps — speech-to-text and text-to-speech, both through
// OpenRouter — plus a `status` read. The reasoning step in between is the
// existing budget-buddy-chat function, untouched as a service: the client
// sends it the transcript like any typed message (with `mode: 'voice'`).
//
//   { action: 'status' }                                        -> allowance
//   { action: 'transcribe', requestId, audioBase64, durationMs } -> { transcript }
//   { action: 'speak', requestId, text }                         -> { audioBase64, mimeType }
//
// Recordings and generated audio exist only in memory for the life of one
// request — nothing is written to disk, Storage, or any table. All rules
// (auth order, entitlement, validation, limits) live in
// _shared/voice-core.ts; this file only wires real dependencies into it.
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { getPlanTier } from '../_shared/usage.ts';
import { synthesizeWithOpenRouter, transcribeWithOpenRouter } from '../_shared/openrouter-audio.ts';
import {
  handleVoiceRequest,
  readVoiceConfig,
  VoiceAuthError,
  type VoiceDeps,
  type VoiceKind,
  type VoiceReserveOutcome,
} from '../_shared/voice-core.ts';

function utcMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  const countThisMonth = async (userId: string, kind: VoiceKind): Promise<number> => {
    const { count, error } = await admin
      .from('voice_usage_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind)
      .neq('status', 'failed')
      .gte('created_at', utcMonthStartIso());
    if (error) throw error;
    return count ?? 0;
  };

  const deps: VoiceDeps = {
    config: readVoiceConfig((name) => Deno.env.get(name)),

    // The caller is always whoever the verified JWT says — a user id in the
    // request body is never read, so one user can't spend another's allowance.
    authenticate: async () => {
      try {
        return await requireUserId(req);
      } catch (error) {
        if (error instanceof AuthError) throw new VoiceAuthError(error.message);
        throw error;
      }
    },

    getPlanTier: (userId) => getPlanTier(admin, userId),

    getMonthlyUsage: async (userId) => {
      const [transcription, speech] = await Promise.all([
        countThisMonth(userId, 'transcription'),
        countThisMonth(userId, 'speech'),
      ]);
      return { transcription, speech };
    },

    reserve: async (args) => {
      const { data, error } = await admin.rpc('reserve_voice_usage', {
        p_user_id: args.userId,
        p_kind: args.kind,
        p_request_id: args.requestId,
        p_monthly_limit: args.monthlyLimit,
        p_rate_limit_per_minute: args.rateLimitPerMinute,
        p_estimated_cost_micro_usd: args.estimatedCostMicroUsd,
        p_monthly_budget_micro_usd: args.monthlyBudgetMicroUsd,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('reserve_voice_usage returned no row.');
      return {
        outcome: row.outcome as VoiceReserveOutcome,
        ledgerId: row.ledger_id ?? undefined,
        usedCount: row.used_count ?? undefined,
      };
    },

    finalize: async (ledgerId, outcome) => {
      const { error } = await admin.rpc('finalize_voice_usage', {
        p_ledger_id: ledgerId,
        p_status: outcome.status,
        p_cost_micro_usd: outcome.costMicroUsd,
        p_cost_source: outcome.costSource,
        p_audio_seconds: outcome.audioSeconds ?? null,
        p_characters: outcome.characters ?? null,
        p_model: outcome.model,
      });
      if (error) throw error;
    },

    // req.signal aborts when the client disconnects (e.g. taps Cancel), which
    // cancels the upstream OpenRouter call rather than letting it run on.
    transcribe: (args) => transcribeWithOpenRouter(args, req.signal),
    synthesize: (args) => synthesizeWithOpenRouter(args, req.signal),

    log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const result = await handleVoiceRequest(deps, body);
  return jsonResponse(result.body, result.status);
});
