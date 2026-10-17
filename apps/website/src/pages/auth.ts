// Sign up, log in and password reset. Same Supabase Auth (email + password)
// the app uses. A chosen paid plan is carried through as ?plan=&billing= plus
// sessionStorage, then the visitor lands on /checkout to review it.
import { getClient, getSession, NOT_CONFIGURED_MESSAGE, safeNextPath } from '../lib/account';
import { $ } from '../lib/dom';
import {
  checkoutHref,
  intentQuery,
  loadIntent,
  planLabel,
  price,
  saveIntent,
  type PlanIntent,
} from '../lib/plans';

const page = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '');
const supabase = getClient();
const intent = loadIntent();
saveIntent(intent);

/** Where to go once signed in: the plan review if a paid plan was picked, else ?next= or My account. */
function destination(i: PlanIntent | null = intent): string {
  if (i && i.plan !== 'free') return checkoutHref(i.plan, i.billing);
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}

function showAlert(message: string | null): void {
  const alert = $('#form-alert');
  if (!alert) return;
  alert.textContent = message ?? '';
  alert.hidden = !message;
}

/** Email already registered: point to log in or password reset, keeping the plan choice. */
function showExistingAccount(): void {
  const alert = $('#form-alert');
  if (!alert) return;
  const q = intent ? `?${intentQuery(intent)}` : '';
  alert.innerHTML =
    'You already have an account with that email. ' +
    `<a href="/login${q}" style="font-weight: 600; text-decoration: underline;">Log in</a> instead, or ` +
    '<a href="/reset-password" style="font-weight: 600; text-decoration: underline;">reset your password</a> if you’ve forgotten it.';
  alert.hidden = false;
  alert.querySelector<HTMLElement>('a')?.focus();
}

function fieldError(id: string, message: string | null): boolean {
  const input = $(`#${id}`) as HTMLInputElement | null;
  const error = $(`#${id}-error`);
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    const described = [`${id}-hint`, message ? `${id}-error` : '']
      .filter((x) => x && document.getElementById(x))
      .join(' ');
    if (described) input.setAttribute('aria-describedby', described);
    else input.removeAttribute('aria-describedby');
  }
  if (error) {
    error.textContent = message ?? '';
    error.hidden = !message;
  }
  return !message;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setBusy(form: HTMLFormElement, busy: boolean, label: string): void {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  button.textContent = label;
}

/** Turns Supabase Auth errors into calm, plain-language messages. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match. Check them and try again.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Look for the link we sent you.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'An account with that email already exists. Try logging in instead.';
  if (m.includes('email address') && m.includes('invalid'))
    return 'That email address can’t be used. Please check it, or try a different one.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'New accounts can’t be created right now. Please try again later.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts just now. Please wait a minute and try again.';
  if (m.includes('password')) return message;
  return 'Something went wrong. Please try again in a moment.';
}

function showIntent(): void {
  const pill = $('#intent-pill');
  const note = $('#intent-note');
  if (intent && intent.plan !== 'free') {
    if (pill) {
      const per = intent.billing === 'yearly' ? '/year' : '/month';
      pill.textContent = `${planLabel(intent.plan)} · ${intent.billing === 'yearly' ? 'Yearly' : 'Monthly'} · ${price(intent.plan, intent.billing)}${per}`;
      pill.hidden = false;
    }
    if (note) note.textContent = 'We’ll keep your plan choice for the next step.';
  }
  const q = intent ? `?${intentQuery(intent)}` : '';
  const sw = $('#switch-link');
  if (sw) sw.setAttribute('href', `${page.endsWith('signup') ? '/login' : '/signup'}${q}`);
  const back = $('#check-login');
  if (back) back.setAttribute('href', `/login${q}`);
}

function blockIfNotConfigured(): boolean {
  if (supabase) return false;
  const note = $('#not-configured');
  if (note) {
    note.textContent = NOT_CONFIGURED_MESSAGE;
    note.hidden = false;
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('form button[type="submit"], [data-oauth]')) b.disabled = true;
  return true;
}

/**
 * "Continue with Google": the same Supabase Google provider the app uses. Google
 * sends people back to this page, which then moves them on (see destination()).
 */
function wireGoogle(): void {
  const button = $('[data-oauth="google"]') as HTMLButtonElement | null;
  if (!button || !supabase) return;
  button.addEventListener('click', async () => {
    showAlert(null);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const back = new URL(window.location.pathname, window.location.origin);
    if (intent) back.search = intentQuery(intent);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: back.toString() },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      showAlert('We couldn’t start Google sign-in. Please try again, or use your email instead.');
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}

async function initSignupOrLogin(isSignup: boolean): Promise<void> {
  showIntent();
  if (new URLSearchParams(window.location.search).has('confirmed')) {
    const note = $('#confirmed-note');
    if (note) note.hidden = false;
  }
  if (blockIfNotConfigured() || !supabase) return;
  // Already signed in (or just returned from the confirmation email or Google): skip ahead.
  if (await getSession()) {
    window.location.replace(destination());
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has('error') || params.has('error_description')) {
    showAlert(
      params.get('error') === 'access_denied'
        ? 'Google sign-in was canceled. You can try again, or use your email instead.'
        : 'We couldn’t sign you in with Google. Please try again, or use your email instead.'
    );
  }
  wireGoogle();
  const form = $('#auth-form') as HTMLFormElement | null;
  if (!form) return;
  const idleLabel = isSignup ? 'Continue' : 'Log in';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAlert(null);
    const email = ($('#email') as HTMLInputElement).value.trim();
    const password = ($('#password') as HTMLInputElement).value;
    const okEmail = fieldError('email', validEmail(email) ? null : 'Enter an email address like name@example.com.');
    const okPassword = fieldError(
      'password',
      !password ? 'Enter your password.' : isSignup && password.length < 8 ? 'Use at least 8 characters.' : null
    );
    if (!okEmail || !okPassword) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(form, true, isSignup ? 'Creating your account…' : 'Logging in…');
    try {
      if (isSignup) {
        const next = destination();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        // Supabase answers a sign-up for an existing email with a "user" that has
        // no identities (and sends no email), so it can't be used to probe emails.
        if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0) {
          showExistingAccount();
          setBusy(form, false, idleLabel);
          return;
        }
        if (data.session) {
          window.location.assign(next);
          return;
        }
        // Email confirmation is on: show "check your email" (same as the app).
        const sentTo = $('#sent-to');
        if (sentTo) sentTo.textContent = email;
        const formSection = form.closest('section');
        if (formSection) formSection.hidden = true;
        const check = $('#check-email');
        if (check) check.hidden = false;
        check?.querySelector<HTMLElement>('a')?.focus();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(destination());
      }
    } catch (error) {
      showAlert(friendly(error instanceof Error ? error.message : String(error)));
      setBusy(form, false, idleLabel);
    }
  });
}

async function initReset(): Promise<void> {
  if (blockIfNotConfigured() || !supabase) return;
  const requestForm = $('#request-form') as HTMLFormElement | null;
  const updateForm = $('#update-form') as HTMLFormElement | null;

  const showUpdate = () => {
    if (requestForm) requestForm.hidden = true;
    if (updateForm) updateForm.hidden = false;
    const title = $('#reset-title');
    if (title) title.textContent = 'Choose a new password';
    const sub = $('#reset-sub');
    if (sub) sub.textContent = 'Enter a new password for your account.';
  };
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showUpdate();
  });
  // The reset email links back here with ?code=…; supabase-js exchanges it on load.
  if (new URLSearchParams(window.location.search).has('code') && (await getSession())) showUpdate();

  requestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAlert(null);
    const email = ($('#email') as HTMLInputElement).value.trim();
    if (!fieldError('email', validEmail(email) ? null : 'Enter an email address like name@example.com.')) return;
    setBusy(requestForm, true, 'Sending…');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(requestForm, false, 'Send reset link');
    if (error) {
      showAlert(friendly(error.message));
      return;
    }
    const sent = $('#reset-sent');
    if (sent) sent.hidden = false;
  });

  updateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAlert(null);
    const password = ($('#new-password') as HTMLInputElement).value;
    if (!fieldError('new-password', password.length < 8 ? 'Use at least 8 characters.' : null)) return;
    setBusy(updateForm, true, 'Saving…');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      showAlert(friendly(error.message));
      setBusy(updateForm, false, 'Save new password');
      return;
    }
    window.location.assign('/account?updated=password');
  });
}

if (page.endsWith('reset-password')) void initReset();
else void initSignupOrLogin(page.endsWith('signup'));
