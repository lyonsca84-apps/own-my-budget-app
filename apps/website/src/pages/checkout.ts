// Checkout review → Stripe Checkout → success / canceled (design states E2–E5).
// Access is never granted from the browser: the success page only *reads* the
// entitlements row, which changes solely when stripe-webhook verifies a Stripe
// event server-side.
import { createCheckoutSession } from '@own-my-budget/api';

import {
  config,
  getClient,
  getSession,
  hasActiveSubscription,
  loadAccount,
  NOT_CONFIGURED_MESSAGE,
  redirectToLogin,
  type Entitlement,
} from '../lib/account';
import { $, longDate, wireBillingToggle } from '../lib/dom';
import {
  billNote,
  intentQuery,
  loadIntent,
  planLabel,
  price,
  saveIntent,
  TRIAL_DAYS,
  type Billing,
  type PaidPlan,
} from '../lib/plans';

const path = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '');
const intent = loadIntent();

function alertMessage(message: string): void {
  const alert = $('#form-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = false;
}

// ---------------------------------------------------------------- review --
async function initReview(): Promise<void> {
  const loading = $('#checkout-loading');
  const review = $('#checkout-review');
  const supabase = getClient();
  if (!supabase) {
    if (loading) loading.innerHTML = `<p class="notice notice-info" style="margin: 0;">${NOT_CONFIGURED_MESSAGE}</p>`;
    return;
  }
  if (!intent || intent.plan === 'free') {
    window.location.replace(intent ? '/account' : '/pricing#plans');
    return;
  }
  saveIntent(intent);
  const session = await getSession();
  if (!session) {
    // Design E1: a signed-out visitor creates an account first; the plan choice comes along.
    window.location.replace(`/signup?${intentQuery(intent)}`);
    return;
  }

  let entitlement: Entitlement;
  try {
    entitlement = (await loadAccount(session)).entitlement;
  } catch {
    if (loading) loading.innerHTML = '<p class="notice notice-warn" role="alert" style="margin: 0;">We couldn’t load your account. Please refresh the page to try again.</p>';
    return;
  }
  // Design E6: active subscribers change plans in the Customer Portal, never a second Checkout.
  if (hasActiveSubscription(entitlement)) {
    window.location.replace('/account?notice=subscribed');
    return;
  }

  const plan = intent.plan as PaidPlan;
  let billing: Billing = intent.billing;
  const render = () => {
    const per = billing === 'yearly' ? '/year' : '/month';
    $('#review-plan')!.textContent = planLabel(plan);
    $('#review-price')!.textContent = `${price(plan, billing)}${per}`;
    const trial = plan === 'budgetBuddy' ? ` Includes a ${TRIAL_DAYS}-day free trial: you won’t be charged if you cancel before it ends.` : '';
    $('#review-note')!.textContent = `${billNote(plan, billing)}. Change or cancel any time in My account.${trial}`;
  };
  wireBillingToggle($('#checkout-billing')!, (b) => {
    billing = b;
    saveIntent({ plan, billing });
    history.replaceState(null, '', `/checkout?${intentQuery({ plan, billing })}`);
    render();
  }, billing);

  if (loading) loading.hidden = true;
  if (review) review.hidden = false;

  const go = $('#checkout-go') as HTMLButtonElement;
  go.addEventListener('click', async () => {
    go.disabled = true;
    go.setAttribute('aria-busy', 'true');
    go.textContent = 'Opening secure checkout…';
    $('#form-alert')!.hidden = true;
    try {
      const q = intentQuery({ plan, billing });
      const url = await createCheckoutSession(supabase, {
        plan,
        interval: billing,
        successUrl: `${window.location.origin}/checkout/success?${q}`,
        cancelUrl: `${window.location.origin}/checkout/canceled?${q}`,
      });
      window.location.assign(url);
    } catch (error) {
      alertMessage(
        error instanceof Error && error.message
          ? error.message
          : 'We couldn’t start checkout. Please try again in a moment.'
      );
      go.disabled = false;
      go.removeAttribute('aria-busy');
      go.textContent = 'Continue to checkout';
    }
  });
}

// --------------------------------------------------------------- success --
async function initSuccess(): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;
  const session = await getSession();
  if (!session) {
    redirectToLogin();
    return;
  }
  const wanted = intent && intent.plan !== 'free' ? intent.plan : null;
  const started = Date.now();
  const slowAfter = 20_000;
  const giveUpAfter = 120_000;

  const done = (e: Entitlement) => {
    saveIntent(null);
    $('#state-confirming')!.hidden = true;
    $('#state-slow')!.hidden = true;
    $('#state-done')!.hidden = false;
    const label = planLabel(e.plan_tier as PaidPlan);
    $('#done-text')!.textContent =
      e.status === 'trialing' && e.trial_ends_at
        ? `Your ${label} trial has started. It ends ${longDate(e.trial_ends_at)}. Stripe will email your receipt.`
        : `${label} is now active. Your receipt is on its way to your email.`;
    const primary = $('#done-primary') as HTMLAnchorElement;
    if (config.appUrl) {
      primary.href = config.appUrl;
      primary.textContent = 'Back to my budget';
    }
    primary.focus();
  };

  const poll = async () => {
    try {
      const { entitlement } = await loadAccount(session);
      const granted =
        entitlement.plan_tier !== 'free' &&
        (entitlement.status === 'active' || entitlement.status === 'trialing') &&
        (!wanted || entitlement.plan_tier === wanted);
      if (granted) return done(entitlement);
    } catch {
      // Keep polling; a transient network error shouldn't end the wait.
    }
    const elapsed = Date.now() - started;
    if (elapsed > slowAfter) $('#state-slow')!.hidden = false;
    if (elapsed < giveUpAfter) window.setTimeout(poll, 2500);
  };
  void poll();
}

// -------------------------------------------------------------- canceled --
function initCanceled(): void {
  const retry = $('#try-again') as HTMLAnchorElement | null;
  if (retry && intent && intent.plan !== 'free') retry.href = `/checkout?${intentQuery(intent)}`;
  else if (retry) retry.href = '/pricing#plans';
}

if (path.endsWith('/checkout/success')) void initSuccess();
else if (path.endsWith('/checkout/canceled')) initCanceled();
else void initReview();
