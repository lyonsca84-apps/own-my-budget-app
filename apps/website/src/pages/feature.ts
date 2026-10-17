// Shared by the Savings goals, Debt tracking and Budget Missions pages.
import { $all, renderFaqs } from '../lib/dom';

const FAQS: Record<string, [string, string][]> = {
  savings: [
    ['Does Own My Budget move money into savings?', 'No. You set money aside in your own account and record your progress in the app.'],
    ['Do I have to start the challenge in January?', 'No. Choose a starting month that works for you.'],
    [
      'What if I cannot save the same amount every time?',
      'Record the amount you actually set aside. Your tracker helps you see your progress as you go.',
    ],
  ],
  debt: [
    ['Does the app pay my bills?', 'No. You make payments through your lender or payment provider and record them in Own My Budget.'],
    ['Can I record more than one payment in a month?', 'Yes. Record separate payments so you can follow your monthly payment activity.'],
    [
      'Are payoff estimates guaranteed?',
      'No. Estimates depend on the information entered. Interest, fees, new charges, and payment changes can affect the result.',
    ],
  ],
  missions: [
    ['Who are these missions for?', 'Own My Budget is designed for ages 14 and up, with learning scenarios for different stages of life.'],
    [
      'Do I need to share real financial information?',
      'These sample missions use fictional situations and amounts. You can explore the lessons without entering your personal finances.',
    ],
    ['Are points and badges money?', 'No. They are planned learning rewards, not cash, investments, or prizes.'],
  ],
};

for (const host of $all('[data-faqs]')) {
  const key = host.dataset.faqs ?? '';
  if (FAQS[key]) renderFaqs(host, FAQS[key], `${key}-faq`);
}

// Example progress bars fill in shortly after load, as in the design.
const bars = $all('[data-bar]');
if (bars.length) {
  window.setTimeout(() => {
    for (const bar of bars) bar.style.width = bar.dataset.bar ?? '0%';
  }, 150);
}
