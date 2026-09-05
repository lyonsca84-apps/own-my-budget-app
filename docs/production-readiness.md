# Production readiness checklist

A consolidated, launch-focused view of every open item and known limitation tracked across Phases 0–9 (see `IMPLEMENTATION_CHECKLIST.md` for the full phase-by-phase history this is drawn from). Grouped by what actually blocks real users touching this app, not by when it came up.

## Launch blockers — must be done before any real user signs up

### Accounts only you can create/authorize

- [ ] **GitHub repo** — not yet connected to this local repository (no git remote configured). Needed before any CI runs on GitHub, before code is backed up off this machine, and before a real deployment pipeline exists.
- [ ] **Apple Developer Program** ($99/yr) — required for Sign in with Apple, TestFlight, and App Store submission. Nothing iOS-facing can ship without this.
- [ ] **RevenueCat account + decision** — still marked "TBD." Blocked on the Apple Developer account above regardless of the decision.
- [ ] **Domain connection** — you own `onmybudget.com`; it isn't pointed at anything yet. Needed before a real production URL exists.
- [ ] **Support email** — not yet chosen. Needed for the App Store listing, the Help/FAQ screen, and account-recovery correspondence.

### Legal (cannot launch without these — this app handles financial data)

- [ ] **Terms of Service** — placeholder text only (`apps/mobile/src/app/help-legal.tsx`), explicitly labeled as such. Needs a lawyer.
- [ ] **Privacy Policy** — same status. Especially important here: the app touches financial records, AI-processed receipt/chat data, and payment info via Stripe — a real privacy policy needs to accurately describe all of that, not a generic template.

### Dashboard-only security settings (I have no API/SQL path to any of these — confirmed, not just untried)

- [ ] Enable "leaked password protection" in Supabase Auth (Authentication → Policies → Password Security)
- [ ] Configure a real SMTP provider for Supabase Auth emails — the current shared service has a very low send-rate limit, discovered the hard way during Phase 3 testing (see `docs/auth-setup.md`)
- [ ] Google OAuth client (Google Cloud Console) — sign-in code already works, provider isn't configured
- [ ] Apple Sign-In (Services ID + key) — code already works, needs the Apple Developer account above first

### Payments

- [ ] Complete the 3 manual Stripe dashboard steps in `docs/stripe-setup.md` (create 4 test-mode Prices, create the webhook endpoint, set 6 Edge Function secrets) if not already done — Phase 8's code is deployed and verified up to this exact point, but a real checkout has never actually completed end-to-end yet
- [ ] Once that's done: run one real test-mode checkout (test card `4242 4242 4242 4242`) and confirm `entitlements` updates via the webhook — the one piece of Phase 8 that's still unverified
- [ ] Separately, later, deliberately: switch from Stripe **test mode** to **live mode** keys only when you're actually ready to accept real payment — never bundled silently into a "deploy" step

### Branding & assets

- [ ] **Final app icon / logo** — `apps/mobile/assets/images/icon.png` and `assets/expo.icon` are still the default Expo template placeholders, not a real Own My Budget mark. You mentioned this isn't designed yet.
- [ ] **`ios.bundleIdentifier`** in `apps/mobile/app.json` is currently the placeholder `com.ownmybudget.app` — confirm the real value before the first App Store Connect registration; it's very hard to change afterward.
- [ ] App Store screenshots, description, keywords, and privacy "nutrition label" answers — none started; the privacy label specifically needs to accurately reflect what's actually collected (I can help draft this once you're ready — the RLS/data model work already documents exactly what's stored where).

### Environment / build tooling

- [ ] **Full Xcode install** — this machine only has the Xcode command-line tools, which blocks the iOS Simulator tooling entirely (confirmed by trying, not assumed) and any local native build. Install Xcode from the Mac App Store, then run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- [ ] `eas.json` doesn't exist yet — needed to produce an actual installable iOS build via EAS Build, once there's an Apple Developer account to sign it with.

## Recommended before launch, not strictly blocking

- No local Supabase CLI/Docker stack — every migration and test this project has run has gone directly against the real hosted dev project. Fine solo; worth setting up before a second contributor joins, so schema changes can be tested locally first.
- No crash reporting or product analytics (e.g. Sentry, PostHog) exists — nothing beyond Supabase's own Postgres/Edge Function logs. A product decision, not built without you (Phase 9).
- Receipt/pantry photos are used for AI extraction but never uploaded to the `receipts`/`pantry` Storage buckets that already exist for them — only the extracted data is saved. A real gap if you want a "view the original receipt photo" feature later; not a blocker for launch.
- Paycheck assignment sets rather than accumulates a category's planned amount when two paychecks land on the same category in one month (Phase 4). Fine for the common case, worth revisiting if that usage pattern turns out to be common.
- Export bundles everything into one JSON + one CSV rather than PLAN.md's literal "per-section" file option (Phase 8) — a deliberate simplification.
- Android is fully deferred per your own decision — nothing here assumes or blocks Android.

## Already solid — verified, not just built (so you know what's _not_ a live risk)

- **Data isolation:** every table across all 17 migrations has row-level security enabled with no gaps and no overly-permissive policy — checked by diffing the full table list against the full RLS-enabled list, not sampled.
- **Secrets hygiene:** no API key, service-role key, or webhook secret has ever been committed to git (checked directly, not assumed) or shipped in the client bundle.
- **CI:** format/lint/typecheck/test run automatically on every push and PR to `main` (once a GitHub remote exists to receive them).
- **Core math:** 79 passing unit tests across money formatting, dates, debt payoff (snowball/avalanche), savings progress, budgeting, and reports — including two real timezone bugs caught and fixed during development, not left latent.
- **Auth:** email/password sign-up, login, logout, password reset, session persistence, and protected routes all verified live against the real project.
- **AI features:** Budget Buddy chat, receipt scanning, and pantry scanning all verified live with real Claude responses (not just reaching the code), with server-side usage metering that can't be bypassed from the client.
- **Payments plumbing:** Stripe Checkout, Billing Portal, and webhook-driven entitlement sync are deployed and verified up to the exact point where your own dashboard configuration takes over — auth, input validation, and error handling all confirmed correct.
- **Account deletion:** verified twice — once directly against the deployed function, once through the actual UI end-to-end — including confirming the cascade actually removes every dependent row, not just the top-level account.
- **Accessibility:** form fields and the web navigation now report correct names/roles/state to screen readers, verified live via the accessibility tree (Phase 9).
