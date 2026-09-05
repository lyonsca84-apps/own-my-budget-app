// Extracts a list of visible food/pantry items from a photo of a fridge or
// shelf. Server-side only. Result is returned for review; the client turns
// confirmed items into grocery_list rows itself (see PLAN.md screens #47-48
// — pantry scanning routes into the existing grocery list, there is no
// separate "pantry items" table).
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';

import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { PANTRY_SCAN_MODEL, MAX_TOKENS_EXTRACTION } from '../_shared/ai-config.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { assertUnderLimit, recordUsage, getPlanTier, UsageLimitError } from '../_shared/usage.ts';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const MAX_BASE64_LENGTH = 11_000_000;

const EXTRACT_PANTRY_TOOL: Anthropic.Tool = {
  name: 'extract_pantry_items',
  description:
    'List the food and pantry items visible in this photo, and what looks low or missing.',
  input_schema: {
    type: 'object',
    properties: {
      visible_items: {
        type: 'array',
        description: 'Items clearly visible and well-stocked.',
        items: { type: 'string' },
      },
      running_low_or_missing: {
        type: 'array',
        description:
          'Common staples that look low, nearly empty, or absent — good grocery-list candidates.',
        items: { type: 'string' },
      },
    },
    required: ['visible_items', 'running_low_or_missing'],
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
    await assertUnderLimit(admin, userId, 'pantryScan', planTier);

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
      model: PANTRY_SCAN_MODEL,
      max_tokens: MAX_TOKENS_EXTRACTION,
      tools: [EXTRACT_PANTRY_TOOL],
      tool_choice: { type: 'tool', name: 'extract_pantry_items' },
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
              text: 'Look at this fridge/pantry photo and call extract_pantry_items.',
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

    await recordUsage(admin, userId, 'pantryScan', planTier);

    return jsonResponse({ extraction: toolUse.input });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof UsageLimitError) {
      return jsonResponse(
        {
          error: `You've used all your pantry scans for this ${error.period === 'monthly' ? 'month' : 'plan'}.`,
          code: 'usage_limit',
        },
        403
      );
    }
    console.error('pantry-scan error:', error);
    return jsonResponse({ error: 'Something went wrong scanning this photo.' }, 500);
  }
});
