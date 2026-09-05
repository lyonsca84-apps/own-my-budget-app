// Creates a Stripe Checkout Session for the caller to subscribe to a paid
// plan. Server-side only — the Stripe secret key never reaches the client.
// The created session (and the subscription it produces) carries the
// caller's own user id in metadata, which is how stripe-webhook later
// knows which of our users a given Stripe subscription belongs to,
// without needing a separate lookup table.
import Stripe from 'npm:stripe@22.6.1';

import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import {
  createStripeClient,
  getPlanPriceId,
  type BillingInterval,
  type PaidPlanTier,
} from '../_shared/stripe-config.ts';

const VALID_PLANS: PaidPlanTier[] = ['guided', 'budgetBuddy'];
const VALID_INTERVALS: BillingInterval[] = ['monthly', 'yearly'];

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const plan: unknown = body?.plan;
    const interval: unknown = body?.interval;
    const successUrl: unknown = body?.successUrl;
    const cancelUrl: unknown = body?.cancelUrl;

    if (typeof plan !== 'string' || !VALID_PLANS.includes(plan as PaidPlanTier)) {
      return jsonResponse({ error: 'plan must be "guided" or "budgetBuddy".' }, 400);
    }
    if (typeof interval !== 'string' || !VALID_INTERVALS.includes(interval as BillingInterval)) {
      return jsonResponse({ error: 'interval must be "monthly" or "yearly".' }, 400);
    }
    if (typeof successUrl !== 'string' || typeof cancelUrl !== 'string') {
      return jsonResponse({ error: 'successUrl and cancelUrl are required.' }, 400);
    }

    const mapping = getPlanPriceId(plan as PaidPlanTier, interval as BillingInterval);
    if (!mapping) {
      return jsonResponse(
        { error: 'That plan is not available yet — its Stripe price has not been configured.' },
        400
      );
    }

    const admin = createAdminClient();
    const { data: entitlement, error: entitlementError } = await admin
      .from('entitlements')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
    if (entitlementError) throw entitlementError;

    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: mapping.priceId, quantity: 1 }],
      customer: entitlement.stripe_customer_id ?? undefined,
      client_reference_id: userId,
      subscription_data: {
        metadata: { supabase_user_id: userId },
        ...(mapping.trialDays ? { trial_period_days: mapping.trialDays } : {}),
      },
      metadata: { supabase_user_id: userId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return jsonResponse({ error: 'Stripe did not return a checkout URL.' }, 502);
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof Stripe.errors.StripeError) {
      console.error('stripe-checkout Stripe error:', error.message);
      return jsonResponse({ error: 'Stripe could not start checkout. Please try again.' }, 502);
    }
    console.error('stripe-checkout error:', error);
    return jsonResponse({ error: 'Something went wrong starting checkout.' }, 500);
  }
});
