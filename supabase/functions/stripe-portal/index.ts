// Creates a Stripe Billing Portal session so the caller can manage, switch,
// or cancel their own subscription — Stripe's hosted portal handles all of
// that, so there's no custom plan-switching UI to build or get wrong here.
import Stripe from 'npm:stripe@22.6.1';

import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireUserId, AuthError } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { createStripeClient } from '../_shared/stripe-config.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const returnUrl: unknown = body?.returnUrl;
    if (typeof returnUrl !== 'string' || !returnUrl) {
      return jsonResponse({ error: 'returnUrl is required.' }, 400);
    }

    const admin = createAdminClient();
    const { data: entitlement, error: entitlementError } = await admin
      .from('entitlements')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
    if (entitlementError) throw entitlementError;

    if (!entitlement.stripe_customer_id) {
      return jsonResponse({ error: "You don't have a subscription to manage yet." }, 400);
    }

    const stripe = createStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: entitlement.stripe_customer_id,
      return_url: returnUrl,
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, 401);
    }
    if (error instanceof Stripe.errors.StripeError) {
      console.error('stripe-portal Stripe error:', error.message);
      return jsonResponse(
        { error: 'Stripe could not open the billing portal. Please try again.' },
        502
      );
    }
    console.error('stripe-portal error:', error);
    return jsonResponse({ error: 'Something went wrong opening the billing portal.' }, 500);
  }
});
