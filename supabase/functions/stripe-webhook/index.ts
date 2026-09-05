// Receives Stripe webhook events and syncs plan/status into our own
// `entitlements` table. Deployed with verify_jwt: false (a deliberate,
// documented exception) -- Stripe webhooks carry no Supabase session,
// they're authenticated instead by verifying the request signature against
// STRIPE_WEBHOOK_SECRET below. This is the only function in this project
// with verify_jwt off, and the only one that needs to be.
//
// Every handler here is idempotent (it sets fields to values computed from
// the event's own data, never increments or appends), so re-processing the
// same event twice is harmless. `processed_webhook_events` is therefore a
// best-effort de-dup log for observability, not a correctness gate --
// recording it BEFORE processing would risk marking an event "done" when
// handling then failed; recording it as a pure side effect after handling
// avoids that trap.
import Stripe from 'npm:stripe@22.6.1';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { jsonResponse } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { createStripeClient, getPriceToPlanMap } from '../_shared/stripe-config.ts';

type EntitlementStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

function mapStripeStatus(status: Stripe.Subscription.Status): {
  entitlementStatus: EntitlementStatus;
  grantsAccess: boolean;
} {
  switch (status) {
    case 'trialing':
      return { entitlementStatus: 'trialing', grantsAccess: true };
    case 'active':
      return { entitlementStatus: 'active', grantsAccess: true };
    case 'past_due':
      // Grace period -- Stripe is still retrying payment. Access is kept
      // until Stripe gives up and the subscription moves to canceled/unpaid.
      return { entitlementStatus: 'past_due', grantsAccess: true };
    default:
      // incomplete, incomplete_expired, canceled, unpaid, paused
      return { entitlementStatus: 'canceled', grantsAccess: false };
  }
}

async function syncSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('stripe-webhook: subscription has no supabase_user_id metadata', subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const mapping = priceId ? getPriceToPlanMap()[priceId] : undefined;
  const { entitlementStatus, grantsAccess } = mapStripeStatus(subscription.status);
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const { error } = await admin
    .from('entitlements')
    .update({
      plan_tier: grantsAccess && mapping ? mapping.planTier : 'free',
      status: entitlementStatus,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      stripe_customer_id: customerId,
    })
    .eq('user_id', userId);
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing Stripe-Signature header.' }, 400);
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set.');
    return jsonResponse({ error: 'Webhook is not configured.' }, 500);
  }

  // Signature verification needs the exact raw body bytes -- req.json()
  // would re-serialize and break the signature.
  const rawBody = await req.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (error) {
    console.error('stripe-webhook: signature verification failed', error);
    return jsonResponse({ error: 'Invalid signature.' }, 400);
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (userId && customerId) {
          const { error } = await admin
            .from('entitlements')
            .update({ stripe_customer_id: customerId })
            .eq('user_id', userId);
          if (error) throw error;
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (userId) {
          const { error } = await admin
            .from('entitlements')
            .update({
              plan_tier: 'free',
              status: 'active',
              trial_ends_at: null,
              current_period_end: null,
            })
            .eq('user_id', userId);
          if (error) throw error;
        }
        break;
      }
      default:
        // Not an event we subscribed to handling -- nothing to do.
        break;
    }
  } catch (error) {
    console.error('stripe-webhook: error handling event', event.type, error);
    // Non-2xx tells Stripe to retry -- correct here, since handling failed
    // and nothing was marked processed yet.
    return jsonResponse({ error: 'Internal error processing webhook.' }, 500);
  }

  // Best-effort log, after successful handling. Never gates processing,
  // and a duplicate-key error here (event already logged, e.g. from a
  // retried delivery that failed harmlessly the second time) is expected
  // and fine to ignore.
  const { error: logError } = await admin
    .from('processed_webhook_events')
    .insert({ id: event.id, source: 'stripe' });
  if (logError && logError.code !== '23505') {
    console.error('stripe-webhook: failed to record processed event', logError);
  }

  return jsonResponse({ received: true });
});
