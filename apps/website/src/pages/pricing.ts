import type { PlanTier } from '@own-my-budget/core';

import { getSession, hasActiveSubscription, loadAccount, type Entitlement } from '../lib/account';
import { $, esc, renderFaqs, wireBillingToggle } from '../lib/dom';
import {
  billNote,
  checkoutHref,
  COMPARE_ROWS,
  PLAN_CARDS,
  price,
  TRIAL_DAYS,
  type Billing,
  type PlanCard,
} from '../lib/plans';

const FAQS: [string, string][] = [
  [
    'Can I use Own My Budget for free?',
    'Yes. The Free plan includes income and expense tracking, bills and due dates, paycheck planning, debt tracking, two savings goals and a few Budget Missions, Budget Buddy questions and photo scans to try. No credit card needed.',
  ],
  [
    `What is included in the ${TRIAL_DAYS}-day trial?`,
    `Budget Buddy starts with a ${TRIAL_DAYS}-day free trial of everything in that plan. You add a payment method at checkout. Cancel before the trial ends and you won’t be charged.`,
  ],
  [
    'What is the difference between Guided and Budget Buddy?',
    'Guided adds unlimited savings goals, full reports, more Budget Missions and a monthly Budget Buddy and photo-scan allowance. Budget Buddy includes everything in Guided, plus the full Mission library, side-by-side payoff comparisons and a much larger AI and photo allowance.',
  ],
  [
    'Are AI and photo tools unlimited?',
    'No. Each plan includes an AI and photo allowance, shown in the table above. Paid allowances reset each month. You can see your usage any time in My account.',
  ],
  [
    'How do monthly and yearly billing work?',
    `Monthly plans are billed once a month. Yearly plans are billed once a year as a single payment: ${price('guided', 'yearly')} for Guided or ${price('budgetBuddy', 'yearly')} for Budget Buddy.`,
  ],
  [
    'How do I manage my subscription?',
    'Go to My account, then Manage subscription. From there you can update your payment method, view invoices, change your plan or cancel.',
  ],
];

let billing: Billing = 'monthly';
let entitlement: Entitlement | null = null;

function ctaFor(card: PlanCard): { html: string; note: string } {
  const base =
    'min-height: 52px; display: flex; align-items: center; justify-content: center; border-radius: 999px; border: 1.5px solid #0E2C52; font-size: 16px; font-weight: 600;';
  const colors = card.highlight ? 'background: #0E2C52; color: #FFFFFF;' : 'background: #FFFFFF; color: #0E2C52;';
  const hover = card.highlight ? 'hv1' : 'hv7';
  const link = (href: string, label: string) =>
    `<a href="${href}" class="${hover}" data-plan="${card.id}" data-billing="${billing}" style="${base} ${colors}">${esc(label)}</a>`;

  // Design state 6: an active subscriber never sees "Choose …" — every change goes
  // through the Customer Portal so nobody ends up with two subscriptions.
  if (entitlement && hasActiveSubscription(entitlement)) {
    const current: PlanTier = entitlement.plan_tier as PlanTier;
    if (card.id === current) return { html: link('/account', 'Manage subscription'), note: 'Your current plan.' };
    if (card.id === 'free') return { html: '', note: 'Included with every account.' };
    return { html: link('/account', 'Switch in My account'), note: 'Switch plans from Manage subscription.' };
  }
  if (entitlement && card.id === 'free') {
    return {
      html: `<span style="${base} border-color: #C0CBDB; color: #56657C;">Your current plan</span>`,
      note: 'No renewal. No payment method on file.',
    };
  }
  return { html: link(checkoutHref(card.id, billing), card.cta), note: card.note };
}

function renderCards(): void {
  const host = $('#plan-cards');
  if (!host) return;
  host.innerHTML = PLAN_CARDS.map((card) => {
    const cta = ctaFor(card);
    const current = entitlement && entitlement.plan_tier === card.id && (card.id === 'free' || hasActiveSubscription(entitlement));
    return `
      <div style="min-width: 0; border-radius: 28px; background: ${card.highlight ? '#E4F6F1' : '#FFFFFF'}; border: ${card.highlight ? '2px solid #2FC6A4' : '1.5px solid #E6EBF2'}; padding: clamp(20px, 2.4vw, 32px); display: flex; flex-direction: column; gap: 14px; box-shadow: 0 24px 48px -36px rgba(14,44,82,0.45);">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 28px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700;">${esc(card.name)}</h2>
          ${card.highlight ? '<span style="padding: 4px 12px; border-radius: 999px; background: #0E2C52; color: #FFFFFF; font-size: 12px; font-weight: 600;">More guidance</span>' : ''}
          ${current ? '<span style="padding: 4px 12px; border-radius: 999px; background: #FFFFFF; border: 1.5px solid #2FC6A4; color: #1A6A5E; font-size: 12px; font-weight: 600;">Current plan</span>' : ''}
        </div>
        <span style="font-size: 15px; color: #3A4A63;">${esc(card.desc)}</span>
        <div style="display: flex; align-items: baseline; gap: 6px;">
          <span style="font-size: clamp(40px, 4vw, 48px); font-weight: 800; letter-spacing: -0.03em; line-height: 1;">${price(card.id, billing)}</span>
          <span style="font-size: 16px; color: #3A4A63;">${card.id === 'free' ? '' : billing === 'yearly' ? '/year' : '/month'}</span>
        </div>
        <span style="font-size: 13px; color: #56657C;">${esc(billNote(card.id, billing))}</span>
        ${cta.html}
        ${cta.note ? `<span style="font-size: 13px; color: #3A4A63; text-align: center;">${esc(cta.note)}</span>` : ''}
        <div style="height: 1px; background: #E6EBF2; margin: 4px 0;"></div>
        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 11px;">
          ${card.features
            .map(
              (f) => `<li style="display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.45;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A8F7A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0; margin-top: 2px;"><path d="M20 6 9 17l-5-5"></path></svg>
                <span>${esc(f)}</span></li>`
            )
            .join('')}
        </ul>
      </div>`;
  }).join('');
}

function renderCompare(): void {
  const host = $('#compare-rows');
  if (!host) return;
  const color = (v: string) => (v === '—' ? '#9AA5B5' : v === '✓' ? '#1A8F7A' : '#0E2C52');
  const cell = (v: string, extra = '') =>
    `<span role="cell" style="padding: 13px 4px; display: flex; align-items: center; justify-content: center; text-align: center; color: ${color(v)};${extra}">${v === '—' ? '<span aria-hidden="true">—</span><span class="sr-only">Not included</span>' : v === '✓' ? '<span aria-hidden="true">✓</span><span class="sr-only">Included</span>' : esc(v)}</span>`;
  host.innerHTML = COMPARE_ROWS.map(
    (r) => `
      <div role="row" class="cmp-cols cmp-row" style="display: grid; border-top: 1px solid #EEF1F5; align-items: stretch;">
        <span role="cell" style="padding: 13px 14px 13px 18px; line-height: 1.4;">${esc(r.label)}</span>
        ${cell(r.cells[0])}${cell(r.cells[1], ' background: #F4FBF9;')}${cell(r.cells[2])}
      </div>`
  ).join('');
}

function wireStickyBar(): void {
  const bar = $('#sticky-plans');
  const plans = $('#plans');
  if (!bar || !plans) return;
  const narrow = window.matchMedia('(max-width: 899px)');
  const update = () => {
    bar.hidden = !(narrow.matches && plans.getBoundingClientRect().bottom < 0);
  };
  window.addEventListener('scroll', update, { passive: true });
  narrow.addEventListener('change', update);
  update();
}

const group = $('#pricing-billing');
if (group) {
  wireBillingToggle(group, (b) => {
    billing = b;
    renderCards();
  });
} else {
  renderCards();
}
renderCompare();
const faqs = $('#pricing-faqs');
if (faqs) renderFaqs(faqs, FAQS, 'pricing-faq');
for (const el of document.querySelectorAll('[data-trial-days]')) el.textContent = String(TRIAL_DAYS);
wireStickyBar();

// Signed-in visitors see their current plan (and subscribers get the portal, not Checkout).
void getSession().then(async (session) => {
  if (!session) return;
  try {
    entitlement = (await loadAccount(session)).entitlement;
    renderCards();
  } catch (error) {
    console.warn('Could not load current plan', error);
  }
});
