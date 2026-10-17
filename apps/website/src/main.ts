// Shared behavior for every page: mobile menu, accordions, the signed-in
// header state, and the Budget Buddy launcher (home page).
import './styles.css';

import { config, getClient } from './lib/account';
import { $, $all, wireAccordions } from './lib/dom';

function wireMobileMenu(): void {
  const burger = $('.nav-burger');
  const menu = $('#mobile-menu');
  if (!burger || !menu) return;
  const set = (open: boolean) => {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };
  burger.addEventListener('click', () => set(menu.hidden));
  for (const link of $all('a', menu)) link.addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      set(false);
      burger.focus();
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => e.matches && set(false));
}

/** Swaps "Log in / Start free" for "My account" when there's a session. */
function wireAuthHeader(): void {
  const supabase = getClient();
  if (!supabase) return;
  const apply = (signedIn: boolean) => {
    for (const el of $all('[data-auth="signed-in"]')) el.hidden = !signedIn;
    for (const el of $all('[data-auth="signed-out"]')) el.hidden = signedIn;
  };
  void supabase.auth.getSession().then(({ data }) => apply(Boolean(data.session)));
  supabase.auth.onAuthStateChange((_event, session) => apply(Boolean(session)));
}

function wireBuddyLauncher(): void {
  const panel = $('#buddy-panel');
  const toggle = $('#buddy-toggle');
  if (!panel || !toggle) return;
  const set = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) $('#buddy-panel a, #buddy-panel button')?.focus();
  };
  toggle.addEventListener('click', () => set(panel.hidden));
  for (const b of $all('[data-buddy-open]')) b.addEventListener('click', () => set(true));
  for (const b of $all('[data-buddy-close]')) {
    b.addEventListener('click', () => {
      set(false);
      toggle.focus();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      set(false);
      toggle.focus();
    }
  });
}

/** Shows the support address where pages ask for it, once VITE_SUPPORT_EMAIL is set. */
function fillSupportEmail(): void {
  if (!config.supportEmail) return;
  for (const el of $all('[data-support-email]')) {
    el.textContent = 'Email us at ';
    const link = document.createElement('a');
    link.href = `mailto:${config.supportEmail}`;
    link.textContent = config.supportEmail;
    el.append(link, '.');
  }
}

wireMobileMenu();
wireAuthHeader();
fillSupportEmail();
wireBuddyLauncher();
wireAccordions();
