import { $, $all, renderFaqs, wireBillingToggle } from '../lib/dom';
import { billNote, checkoutHref, parsePlan, price, TRIAL_DAYS } from '../lib/plans';

const FAQS: [string, string][] = [
  [
    'Does Own My Budget give financial advice?',
    'No. Own My Budget and Budget Buddy provide general educational information to help you learn and organize. For advice about your situation, talk with a qualified professional.',
  ],
  ['Is Own My Budget a bank?', 'No. It’s an educational budgeting tool. It doesn’t hold or move your money.'],
  [
    'Is it good for beginners?',
    'Yes. Start with one bill and one paycheck, and ask your Budget Buddy to explain anything.',
  ],
  ['Does it work with irregular income?', 'Yes. Add pay as it arrives and plan by pay period.'],
  [
    'Can I try paid features first?',
    `Yes. Budget Buddy starts with a ${TRIAL_DAYS}-day free trial. You add a payment method at checkout, and you won’t be charged if you cancel before the trial ends.`,
  ],
  [
    'Can I cancel anytime?',
    'Yes. Go to My account, then Manage subscription, to cancel or change your plan at any time.',
  ],
];

const group = $('#home-billing');
if (group) {
  wireBillingToggle(group, (billing) => {
    for (const el of $all('[data-price]')) {
      const tier = parsePlan(el.dataset.price);
      if (tier) el.textContent = price(tier, billing);
    }
    for (const el of $all('[data-per]')) el.textContent = billing === 'yearly' ? '/year' : '/month';
    const note = $('[data-note="guided"]');
    if (note) note.textContent = billNote('guided', billing);
    for (const a of $all('a[data-plan]')) {
      const tier = parsePlan(a.dataset.plan);
      if (tier && tier !== 'free') a.setAttribute('href', checkoutHref(tier, billing));
    }
  });
}

const faqs = $('#home-faqs');
if (faqs) renderFaqs(faqs, FAQS, 'home-faq');
