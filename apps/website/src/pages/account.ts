// Account › Plan & Billing (design D / D2 / E8). Reads the caller's own
// entitlement and usage rows (RLS-scoped); "Manage subscription" opens the
// Stripe Customer Portal via the stripe-portal Edge Function.
import { FEATURE_REGISTRY, getUsagePeriodStart, type PlanTier } from '@own-my-budget/core';
import { createPortalSession, getFeatureUsageCount } from '@own-my-budget/api';

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
import { $, esc, longDate } from '../lib/dom';
import { METERED, planLabel } from '../lib/plans';

const WARN_AT = 0.8;

function show(id: string, on = true): HTMLElement | null {
  const el = $(`#${id}`);
  if (el) el.hidden = !on;
  return el;
}

function notice(id: string, text: string): void {
  const el = show(id);
  if (el) el.textContent = text;
}

function describePlan(e: Entitlement): { detail: string; renew: string } {
  const tier = e.plan_tier as PlanTier;
  if (tier === 'free' || e.status === 'canceled') {
    return { detail: 'No renewal. No payment method on file.', renew: '' };
  }
  if (e.status === 'trialing') {
    return {
      detail: `${planLabel(tier)} free trial`,
      renew: e.trial_ends_at
        ? `Trial ends ${longDate(e.trial_ends_at)}. Your plan starts then unless you cancel before that date.`
        : '',
    };
  }
  if (e.status === 'past_due') {
    return { detail: `${planLabel(tier)} · payment needs attention`, renew: '' };
  }
  return {
    detail: planLabel(tier),
    renew: e.current_period_end ? `Renews ${longDate(e.current_period_end)}` : '',
  };
}

async function renderUsage(userId: string, tier: PlanTier): Promise<void> {
  const supabase = getClient();
  const list = $('#usage-list');
  if (!supabase || !list) return;
  const rows = await Promise.all(
    METERED.map(async ({ key, label }) => {
      const limit = FEATURE_REGISTRY[key].limits[tier];
      if (limit.kind !== 'count' || !limit.period) {
        return { label, text: limit.kind === 'unlimited' ? 'Unlimited' : '', pct: null as number | null };
      }
      const used = await getFeatureUsageCount(supabase, userId, key, getUsagePeriodStart(limit.period));
      const pct = Math.min(1, used / limit.limit);
      const suffix = limit.period === 'lifetime' ? 'to try' : 'this month';
      return { label, text: `${used} of ${limit.limit} used ${suffix}`, pct };
    })
  );
  list.innerHTML = rows
    .filter((r) => r.text)
    .map((r) => {
      if (r.pct === null) {
        return `<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 15px;"><span>${esc(r.label)}</span><strong>${esc(r.text)}</strong></div>`;
      }
      const pct = Math.round(r.pct * 100);
      const full = r.pct >= 1;
      const warn = r.pct >= WARN_AT;
      const msg = full
        ? 'You’ve reached this allowance. It comes back when it resets. All your budgeting tools still work.'
        : warn
          ? 'You’ve used most of this allowance.'
          : '';
      return `<div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 15px;"><span>${esc(r.label)}</span><strong>${esc(r.text)}</strong></div>
        <div role="progressbar" aria-label="${esc(r.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="height: 10px; border-radius: 999px; background: #EEF2F8; overflow: hidden;"><div style="width: ${pct}%; height: 100%; border-radius: 999px; background: ${warn ? '#F58220' : '#21B85C'};"></div></div>
        ${msg ? `<span style="font-size: 13px; color: ${full ? '#7A3D07' : '#56657C'};">${esc(msg)}</span>` : ''}
      </div>`;
    })
    .join('');
  show('usage-card', list.innerHTML.trim().length > 0);
}

async function init(): Promise<void> {
  const supabase = getClient();
  if (!supabase) {
    show('account-loading', false);
    notice('account-error', NOT_CONFIGURED_MESSAGE);
    return;
  }
  const session = await getSession();
  if (!session) {
    redirectToLogin();
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('updated') === 'password') notice('account-notice', 'Your password has been updated.');
  if (params.get('notice') === 'subscribed') {
    notice('account-notice', 'You already have a paid plan. To switch plans, use Manage subscription below.');
  }
  const email = $('#account-email');
  if (email) email.textContent = `Signed in as ${session.user.email ?? 'your account'}`;

  let entitlement: Entitlement;
  try {
    entitlement = (await loadAccount(session)).entitlement;
  } catch {
    show('account-loading', false);
    notice('account-error', 'We couldn’t load your plan. Please refresh the page to try again.');
    return;
  }
  show('account-loading', false);

  const tier = (entitlement.status === 'canceled' ? 'free' : entitlement.plan_tier) as PlanTier;
  const { detail, renew } = describePlan(entitlement);
  $('#plan-name')!.textContent = planLabel(tier);
  $('#plan-detail')!.textContent = detail;
  const renewEl = $('#plan-renew')!;
  renewEl.textContent = renew;
  renewEl.hidden = !renew;
  if (entitlement.status === 'past_due') {
    notice(
      'account-error',
      `Your last payment didn’t go through. Update your payment method in Manage subscription to keep ${planLabel(tier)}.`
    );
  }

  const paid = hasActiveSubscription(entitlement);
  const seePlans = $('#see-plans') as HTMLAnchorElement;
  seePlans.textContent = paid ? 'Compare plans' : 'See paid plans';
  if (entitlement.stripe_customer_id) {
    show('portal-note');
    const manage = show('manage-sub') as HTMLButtonElement;
    manage.addEventListener('click', async () => {
      manage.disabled = true;
      manage.setAttribute('aria-busy', 'true');
      manage.textContent = 'Opening billing…';
      try {
        const url = await createPortalSession(supabase, `${window.location.origin}/account`);
        window.location.assign(url);
      } catch (error) {
        notice('account-error', error instanceof Error && error.message ? error.message : 'We couldn’t open billing. Please try again.');
        manage.disabled = false;
        manage.removeAttribute('aria-busy');
        manage.textContent = 'Manage subscription';
      }
    });
  }
  show('plan-card');

  show('session-card');
  if (config.appUrl) {
    const open = show('open-app') as HTMLAnchorElement;
    open.href = config.appUrl;
  }
  $('#sign-out')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.assign('/');
  });

  try {
    await renderUsage(session.user.id, tier);
  } catch (error) {
    console.warn('Could not load usage', error);
  }
}

void init();
