// Budget Buddy: a chat assistant scoped to the caller's own financial data.
// Server-side only. Chat history is NOT persisted here — the client keeps it
// in local state only, which is also what makes "delete my chat history" a
// trivial client-side "Clear chat" action rather than a data-deletion
// feature. Context sent to the model is a small computed summary, never a
// raw dump of transactions.
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import {
  BUDGET_BUDDY_MODEL,
  MAX_TOKENS_CHAT,
  MAX_TOKENS_VOICE_CHAT,
} from '../_shared/ai-config.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { assertUnderLimit, recordUsage, getPlanTier, UsageLimitError } from '../_shared/usage.ts';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;

const SYSTEM_PROMPT = `You are Budget Buddy, a supportive, non-judgmental budgeting assistant inside the Own My Budget app.

Ground rules:
- Only use the FINANCIAL SNAPSHOT provided below. Never invent balances, bills, or amounts that aren't in it.
- You are not a licensed financial, tax, legal, or investment advisor. You must refuse to give individualized investment advice (e.g. "should I buy X stock"), tax filing advice, or legal advice. When asked, say plainly that you can't give that kind of advice and suggest they talk to a licensed professional — then, if relevant, offer general budgeting help instead.
- Keep a warm, encouraging, non-judgmental tone. Never shame the user for debt, spending, or missed goals.
- Keep responses concise — a few short paragraphs or a short list, not an essay.
- You cannot take any action (you cannot move money, pay bills, or change budget data) — you can only discuss and suggest.
- Budget Missions: you may explain a mission, ask questions about it, and talk through choices and their consequences. Only the app decides points, badges, and whether a mission is complete — never award, promise, or announce any of those yourself, and never describe mission progress that isn't in the snapshot.`;

// Appended only when the message was spoken (body.mode === 'voice'). The
// base instructions above still apply in full — this only shapes delivery
// for a reply that will be read aloud, and adds the care a speech-to-text
// transcript needs.
const VOICE_PROMPT = `VOICE MODE — this message was spoken, and your reply will be read aloud:
- Sound warm, calm, encouraging, and plain-spoken. Usually reply in 2–4 short sentences.
- Write the way a person talks: no lists, headings, markdown, emoji, or symbols. Say dollar amounts the way you would say them out loud.
- Ask at most one useful follow-up question at a time.
- Explain money ideas as general education, not as personal advice.
- Shape explanations around the life stage the person has told you about. Never guess their age or situation.
- No shaming, no pressure, and no promises about how things will turn out financially.
- The message came from speech-to-text and may contain mistakes. If an amount, a date, a name, or an instruction is unclear or could be heard two ways, ask one short question to confirm it before going any further — never assume.
- Don't work out new figures of your own from their money. Use the numbers in the snapshot as they are, and point them to the screen in the app that does a calculation (payoff plans, totals) when they need one.
- By voice you only explain and guide. If they ask you to save, pay, or change something, say you can't do that by voice, and tell them exactly what they could enter themselves in the app so they can review and confirm it there.`;

interface FinancialSnapshot {
  planTier: string;
  incomeTotalCents: number;
  upcomingBills: { label: string; amountCents: number; dueDate: string }[];
  debts: { label: string; balanceCents: number; aprBasisPoints: number }[];
  savingsGoals: { label: string; savedCents: number; targetCents: number }[];
  missions: { title: string; description: string; status: string }[];
}

/**
 * The integration boundary for Budget Missions: the caller's own started
 * missions, read-only, as plain context. Mission rules (points, badges,
 * completion) are not here and never will be decided by the model — when
 * the Missions library ships its rules, this is the one place to add the
 * app-computed state Budget Buddy is allowed to talk about. A failure here
 * must never take the chat down, so it degrades to "none on file".
 */
async function buildMissionContext(
  admin: SupabaseClient,
  userId: string
): Promise<FinancialSnapshot['missions']> {
  const { data, error } = await admin
    .from('user_missions')
    .select('status, missions(title, description)')
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .order('started_at', { ascending: false })
    .limit(5);
  if (error || !data) {
    console.error('budget-buddy-chat: mission context unavailable.');
    return [];
  }
  return data.flatMap((row) => {
    const mission = Array.isArray(row.missions) ? row.missions[0] : row.missions;
    return mission
      ? [{ title: mission.title, description: mission.description, status: row.status }]
      : [];
  });
}

async function buildFinancialSnapshot(
  admin: SupabaseClient,
  userId: string,
  planTier: string
): Promise<FinancialSnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  const [income, bills, debts, goals, missions] = await Promise.all([
    admin
      .from('income_sources')
      .select('amount_cents')
      .eq('user_id', userId)
      .is('archived_at', null),
    admin
      .from('bills')
      .select('label, amount_cents, due_date')
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('due_date', today)
      .order('due_date')
      .limit(5),
    admin
      .from('debts')
      .select('label, balance_cents, apr_basis_points')
      .eq('user_id', userId)
      .is('archived_at', null)
      .limit(10),
    admin
      .from('savings_goals')
      .select('label, saved_cents, target_cents')
      .eq('user_id', userId)
      .is('archived_at', null)
      .limit(10),
    buildMissionContext(admin, userId),
  ]);

  if (income.error) throw income.error;
  if (bills.error) throw bills.error;
  if (debts.error) throw debts.error;
  if (goals.error) throw goals.error;

  return {
    planTier,
    incomeTotalCents: income.data.reduce((sum, row) => sum + row.amount_cents, 0),
    upcomingBills: bills.data.map((b) => ({
      label: b.label,
      amountCents: b.amount_cents,
      dueDate: b.due_date,
    })),
    debts: debts.data.map((d) => ({
      label: d.label,
      balanceCents: d.balance_cents,
      aprBasisPoints: d.apr_basis_points,
    })),
    savingsGoals: goals.data.map((g) => ({
      label: g.label,
      savedCents: g.saved_cents,
      targetCents: g.target_cents,
    })),
    missions,
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function snapshotToText(snapshot: FinancialSnapshot): string {
  const lines = [
    `Plan: ${snapshot.planTier}`,
    `Total recurring income: ${formatCents(snapshot.incomeTotalCents)}`,
    '',
    'Upcoming bills:',
    ...(snapshot.upcomingBills.length
      ? snapshot.upcomingBills.map(
          (b) => `- ${b.label}: ${formatCents(b.amountCents)} due ${b.dueDate}`
        )
      : ['- none on file']),
    '',
    'Debts:',
    ...(snapshot.debts.length
      ? snapshot.debts.map(
          (d) =>
            `- ${d.label}: ${formatCents(d.balanceCents)} balance at ${(d.aprBasisPoints / 100).toFixed(2)}% APR`
        )
      : ['- none on file']),
    '',
    'Savings goals:',
    ...(snapshot.savingsGoals.length
      ? snapshot.savingsGoals.map(
          (g) => `- ${g.label}: ${formatCents(g.savedCents)} of ${formatCents(g.targetCents)}`
        )
      : ['- none on file']),
    '',
    'Budget Missions they have started (status is set by the app):',
    ...(snapshot.missions.length
      ? snapshot.missions.map((m) => `- ${m.title} [${m.status}]: ${m.description}`)
      : ['- none on file']),
  ];
  return lines.join('\n');
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);
    const admin = createAdminClient();
    const planTier = await getPlanTier(admin, userId);
    await assertUnderLimit(admin, userId, 'budgetBuddyAction', planTier);

    const body = await req.json();
    const message: unknown = body?.message;
    const historyInput: unknown = body?.history;
    // Set by the client for a spoken message. It changes only how the reply
    // is shaped — same model, same snapshot, same plan allowance as typing.
    const isVoice = body?.mode === 'voice';

    if (typeof message !== 'string' || message.trim().length === 0) {
      return jsonResponse({ error: 'message is required.' }, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: 'Message is too long.' }, 400);
    }

    const history: ChatHistoryMessage[] = Array.isArray(historyInput)
      ? historyInput
          .filter(
            (m): m is ChatHistoryMessage =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string' &&
              m.content.length <= MAX_MESSAGE_LENGTH
          )
          .slice(-MAX_HISTORY_MESSAGES)
      : [];

    const snapshot = await buildFinancialSnapshot(admin, userId, planTier);

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: BUDGET_BUDDY_MODEL,
      max_tokens: isVoice ? MAX_TOKENS_VOICE_CHAT : MAX_TOKENS_CHAT,
      output_config: { effort: 'medium' },
      system: `${SYSTEM_PROMPT}${isVoice ? `\n\n${VOICE_PROMPT}` : ''}\n\nFINANCIAL SNAPSHOT:\n${snapshotToText(snapshot)}`,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: message },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return jsonResponse({
        reply:
          "I can't help with that one, but I'm happy to help with your budget, bills, debt, or savings goals instead.",
      });
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    await recordUsage(admin, userId, 'budgetBuddyAction', planTier);

    return jsonResponse({
      reply: textBlock?.text ?? "Sorry, I didn't catch that — could you try rephrasing?",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof UsageLimitError) {
      return jsonResponse(
        {
          error: `You've used all your Budget Buddy actions for this ${error.period === 'monthly' ? 'month' : 'plan'}.`,
          code: 'usage_limit',
        },
        403
      );
    }
    console.error('budget-buddy-chat error:', error);
    return jsonResponse({ error: 'Something went wrong talking to Budget Buddy.' }, 500);
  }
});
