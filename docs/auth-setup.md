# Authentication setup

## What already works (verified against the live project)

Email/password sign-up, login, logout, forgot/reset-password, session persistence, and protected routes are fully built and tested end-to-end against the real Supabase project (`soapkqeaodjawxrvslob`). Google and Apple sign-in are wired up in code (`supabase.auth.signInWithOAuth`) but **will not work until you configure the providers below** — clicking those buttons today will error, by design, rather than silently doing nothing.

## Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth 2.0 Client ID (APIs & Services → Credentials → Create Credentials → OAuth client ID).
   - Application type: **Web application** (Supabase's OAuth flow always goes through its own web callback, even for the native app).
   - Authorized redirect URI: `https://soapkqeaodjawxrvslob.supabase.co/auth/v1/callback`
2. In the Supabase dashboard: **Authentication → Providers → Google** — paste in the Client ID and Client Secret from step 1, and enable the provider.
3. No app code changes needed — `signInWithGoogle()` in `auth-context.tsx` already calls the right API; it just needs the provider enabled server-side.

## Sign in with Apple

Requires an active **Apple Developer Program membership** ($99/yr — you don't have one yet, per the implementation checklist). Once you do:

1. Create a **Services ID** in the Apple Developer portal, with "Sign in with Apple" enabled, configured for the domain `soapkqeaodjawxrvslob.supabase.co` and the return URL `https://soapkqeaodjawxrvslob.supabase.co/auth/v1/callback`.
2. Create a **Sign in with Apple key** (a `.p8` private key) tied to that Services ID.
3. In the Supabase dashboard: **Authentication → Providers → Apple** — enter the Services ID, Team ID, Key ID, and the private key contents.
4. For the native iOS app specifically (not just the web OAuth redirect), Apple requires the app's own "Sign in with Apple" capability enabled in its App ID/provisioning profile too — that's part of the eventual EAS/Xcode build configuration, not something configurable from the dashboard alone.

## Email delivery

The project is currently using Supabase's shared/default email service, which has a **very low send-rate limit** — enough to prove the flow works (confirmed during Phase 3 testing) but not enough for real signups. Before public launch: **Authentication → Settings → SMTP Settings**, configure a real provider (Resend, Postmark, SES, etc.) with a domain you control.

Also flagged by the security advisor and still open: enable **"leaked password protection"** (Authentication → Policies → Password Security) before real users can sign up.

## Environment variables

No new ones beyond what Phase 2 already documented (`docs/database.md`) — OAuth provider secrets live only in the Supabase dashboard, never in the app's `.env`.

## Known limitation

Password-reset email links land the user back in the app with a real (if short-lived) Supabase session rather than routing through a dedicated "verify" step — this is standard Supabase behavior, handled by treating that moment as a distinct `passwordRecovery` auth status (see `auth-context.tsx`) that routes to a "set a new password" screen instead of the normal signed-in tab shell.
