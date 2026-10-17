// Server-only typed client for the orchestration loop's "Claude extracts a
// structured proposal" step. Claude is told explicitly NOT to do date math —
// spoken-date.ts converts whatever string Claude returns, deterministically
// (see that file's doc comment, and ai-orchestrate/index.ts for the full
// loop). Never throws — every failure path returns `{ ok: false, reason }`.
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import { ORCHESTRATOR_MODEL, MAX_TOKENS_ORCHESTRATOR } from './ai-config.ts';

const REQUEST_TIMEOUT_MS = 15_000;

export interface BillPaymentExtraction {
  bill_name: string | null;
  amount_dollars: number | null;
  spoken_date: string | null;
}

export type ExtractionResult =
  | { ok: true; attempt: BillPaymentExtraction; tokensUsed: number }
  | { ok: false; reason: 'timeout' | 'network_error' | 'invalid_response' | 'not_configured' };

const SYSTEM_PROMPT = `You are a structured-data extractor inside Own My Budget's AI orchestration layer. You never give financial advice and you never do date math yourself — only extract.

Given a short piece of text where a user reports paying a bill, respond with ONLY a single JSON object, no markdown fences, no prose, no explanation:
{"bill_name": string|null, "amount_dollars": number|null, "spoken_date": string|null}

Rules:
- bill_name: the payee/bill name as stated (e.g. "Georgia Power", "rent"). null if not mentioned.
- amount_dollars: a plain number (e.g. 75 or 75.5). null if not mentioned. Never guess a value that wasn't stated.
- spoken_date: the date EXACTLY as the user said it (e.g. "yesterday", "October 3rd") — do not convert it to a calendar date yourself, that happens elsewhere. null if not mentioned.
- If a field truly cannot be determined from the text, use null for it. Never invent a value.`;

function isExtraction(value: unknown): value is BillPaymentExtraction {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const okString = (x: unknown) => x === null || typeof x === 'string';
  const okNumber = (x: unknown) => x === null || typeof x === 'number';
  return (
    'bill_name' in v &&
    'amount_dollars' in v &&
    'spoken_date' in v &&
    okString(v.bill_name) &&
    okNumber(v.amount_dollars) &&
    okString(v.spoken_date)
  );
}

export async function extractBillPayment(
  text: string,
  revision?: { priorAttempt: BillPaymentExtraction; reason: string }
): Promise<ExtractionResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('claude-client: ANTHROPIC_API_KEY is not set.');
    return { ok: false, reason: 'not_configured' };
  }

  const userMessage = revision
    ? `Text: "${text}"\n\nYour previous attempt was ${JSON.stringify(revision.priorAttempt)}, which needs revision: ${revision.reason}. Re-read the text and try again. Respond with ONLY the JSON object.`
    : `Text: "${text}"`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create(
      {
        model: ORCHESTRATOR_MODEL,
        max_tokens: MAX_TOKENS_ORCHESTRATOR,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    );

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    if (!textBlock) return { ok: false, reason: 'invalid_response' };

    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { ok: false, reason: 'invalid_response' };
    }
    if (!isExtraction(parsed)) {
      return { ok: false, reason: 'invalid_response' };
    }

    const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
    return { ok: true, attempt: parsed, tokensUsed };
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network_error';
    return { ok: false, reason };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
