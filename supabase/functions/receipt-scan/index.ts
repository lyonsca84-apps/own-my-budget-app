// Extracts store/date/line-items/totals from a photographed receipt.
// Server-side only — the Anthropic API key never reaches the client. The
// result is returned for the mandatory review-and-correct screen; this
// function never writes to receipts/receipt_items itself (see PLAN.md
// screen #45 — "nothing saves until confirmed").
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';

import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { RECEIPT_SCAN_MODEL, MAX_TOKENS_EXTRACTION } from '../_shared/ai-config.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { assertUnderLimit, recordUsage, getPlanTier, UsageLimitError } from '../_shared/usage.ts';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

// Base64 is ~33% larger than raw bytes; this caps raw image size at ~8MB,
// comfortably under Anthropic's per-image limit while blocking abusive payloads.
const MAX_BASE64_LENGTH = 11_000_000;

const EXTRACT_RECEIPT_TOOL: Anthropic.Tool = {
  name: 'extract_receipt',
  description: 'Extract structured data from a photographed store receipt.',
  input_schema: {
    type: 'object',
    properties: {
      store_label: {
        type: ['string', 'null'],
        description: 'Store or merchant name, or null if illegible.',
      },
      purchased_on: {
        type: ['string', 'null'],
        description: 'Purchase date as YYYY-MM-DD, or null if not visible.',
      },
      items: {
        type: 'array',
        description: 'Line items on the receipt.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            category: {
              type: ['string', 'null'],
              description:
                'A short grocery/spending category guess, e.g. "Produce", "Household". Null if unsure.',
            },
            price_cents: { type: 'integer', description: 'Line total in integer cents.' },
            quantity: { type: 'number', description: 'Quantity, default 1.' },
          },
          required: ['label', 'category', 'price_cents', 'quantity'],
          additionalProperties: false,
        },
      },
      subtotal_cents: {
        type: ['integer', 'null'],
        description: 'Subtotal before tax, in integer cents.',
      },
      tax_cents: { type: ['integer', 'null'], description: 'Tax amount, in integer cents.' },
      total_cents: { type: ['integer', 'null'], description: 'Final total, in integer cents.' },
    },
    required: [
      'store_label',
      'purchased_on',
      'items',
      'subtotal_cents',
      'tax_cents',
      'total_cents',
    ],
    additionalProperties: false,
  },
  strict: true,
};

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);
    const admin = createAdminClient();
    const planTier = await getPlanTier(admin, userId);
    await assertUnderLimit(admin, userId, 'receiptScan', planTier);

    const body = await req.json();
    const imageBase64: unknown = body?.imageBase64;
    const mediaType: unknown = body?.mediaType;

    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      return jsonResponse({ error: 'imageBase64 is required.' }, 400);
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return jsonResponse({ error: 'Image is too large.' }, 400);
    }
    if (
      typeof mediaType !== 'string' ||
      !ALLOWED_MEDIA_TYPES.includes(mediaType as AllowedMediaType)
    ) {
      return jsonResponse(
        { error: 'mediaType must be one of image/jpeg, image/png, image/webp, image/gif.' },
        400
      );
    }

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: RECEIPT_SCAN_MODEL,
      max_tokens: MAX_TOKENS_EXTRACTION,
      tools: [EXTRACT_RECEIPT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as AllowedMediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract this receipt into the extract_receipt tool. If a field is illegible, use null rather than guessing.',
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    if (!toolUse) {
      return jsonResponse(
        { error: 'The model did not return structured data. Try a clearer photo.' },
        502
      );
    }

    await recordUsage(admin, userId, 'receiptScan', planTier);

    return jsonResponse({ extraction: toolUse.input });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof UsageLimitError) {
      return jsonResponse(
        {
          error: `You've used all your receipt scans for this ${error.period === 'monthly' ? 'month' : 'plan'}.`,
          code: 'usage_limit',
        },
        403
      );
    }
    console.error('receipt-scan error:', error);
    return jsonResponse({ error: 'Something went wrong extracting this receipt.' }, 500);
  }
});
