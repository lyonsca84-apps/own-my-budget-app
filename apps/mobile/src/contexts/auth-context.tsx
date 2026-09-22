import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import { GUEST_USER_ID, getProfile, updateProfile } from '@own-my-budget/api';

import {
  activateGuestData,
  deactivateGuestData,
  realSupabase,
  resetGuestData as resetGuestStore,
  supabase,
} from '@/lib/supabase';

const GUEST_MODE_KEY = 'own-my-budget:guest-mode';

/**
 * Without an explicit redirectTo, GoTrue sends the browser back to the
 * project's Site URL — a single dashboard setting that can't track every
 * host this app is served from. Passing the page's own origin here keeps
 * the redirect correct regardless of what Site URL happens to be set to,
 * as long as that origin is also in Supabase's Redirect URLs allowlist.
 * Native has no window/URL to redirect through, so it's left unset there.
 */
function oauthRedirectOptions() {
  return Platform.OS === 'web' ? { redirectTo: window.location.origin } : undefined;
}

export type AuthStatus =
  'loading' | 'signedOut' | 'guest' | 'needsOnboarding' | 'signedIn' | 'passwordRecovery';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  continueAsGuest: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
  /** True while exploring as a guest (status === 'guest'). */
  isGuest: boolean;
  /**
   * The id to load data with: the real user's id when signed in, the fixed
   * fake guest id in guest mode, otherwise null. `supabase` (lib/supabase)
   * already routes to the matching database, so screens use the same code for
   * both — see `useDataUser()` for the ready-made gate.
   */
  dataUserId: string | null;
  /** Wipes guest edits and restores the sample data. Bumps `guestDataVersion`. */
  resetGuestData: () => void;
  /** Changes whenever guest data is reset — include it in a data-loading effect's deps to reload. */
  guestDataVersion: number;
  /** Marks the signed-in user's onboarding wizard as done, both in Supabase and locally. */
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type OnboardingStatus = 'unknown' | 'incomplete' | 'complete';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('unknown');
  const [guestDataVersion, setGuestDataVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadOnboardingStatus(userId: string) {
      try {
        const profile = await getProfile(realSupabase, userId);
        if (!isMounted) return;
        setOnboardingStatus(profile.onboarding_completed_at ? 'complete' : 'incomplete');
      } catch {
        // Transient fetch failure — try again shortly rather than stranding
        // the user on the loading screen or wrongly re-showing onboarding.
        if (isMounted) setOnboardingStatus('unknown');
      }
    }

    async function init() {
      const [{ data }, storedGuestFlag] = await Promise.all([
        realSupabase.auth.getSession(),
        AsyncStorage.getItem(GUEST_MODE_KEY),
      ]);
      if (!isMounted) return;
      setSession(data.session);
      const resumeGuest = storedGuestFlag === 'true' && !data.session;
      // Point `supabase` at the in-memory demo database before any guest screen mounts.
      if (resumeGuest) activateGuestData();
      setIsGuest(resumeGuest);
      setHasLoadedOnce(true);
      if (data.session) void loadOnboardingStatus(data.session.user.id);
    }

    init();

    const {
      data: { subscription },
    } = realSupabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // A real sign-in always wins over a lingering guest flag — and gets the real database back.
      if (nextSession) {
        deactivateGuestData();
        setIsGuest(false);
      }
      // Clicking the password-reset email link creates a real session, but
      // it must land on the "set a new password" screen, not the tab shell
      // — this event is Supabase's signal that's exactly what happened.
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        setOnboardingStatus('unknown');
      }
      if (nextSession) void loadOnboardingStatus(nextSession.user.id);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = !hasLoadedOnce
      ? 'loading'
      : isPasswordRecovery
        ? 'passwordRecovery'
        : session
          ? onboardingStatus === 'unknown'
            ? 'loading'
            : onboardingStatus === 'incomplete'
              ? 'needsOnboarding'
              : 'signedIn'
          : isGuest
            ? 'guest'
            : 'signedOut';

    return {
      status,
      session,
      user: session?.user ?? null,

      async signUp(email, password) {
        const { error } = await realSupabase.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },

      async signIn(email, password) {
        const { error } = await realSupabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },

      async signInWithGoogle() {
        const { error } = await realSupabase.auth.signInWithOAuth({
          provider: 'google',
          options: oauthRedirectOptions(),
        });
        return { error: error?.message ?? null };
      },

      async signInWithApple() {
        const { error } = await realSupabase.auth.signInWithOAuth({
          provider: 'apple',
          options: oauthRedirectOptions(),
        });
        return { error: error?.message ?? null };
      },

      async signOut() {
        await realSupabase.auth.signOut();
      },

      async requestPasswordReset(email) {
        const { error } = await realSupabase.auth.resetPasswordForEmail(email);
        return { error: error?.message ?? null };
      },

      async updatePassword(newPassword) {
        const { error } = await realSupabase.auth.updateUser({ password: newPassword });
        if (!error) setIsPasswordRecovery(false);
        return { error: error?.message ?? null };
      },

      async continueAsGuest() {
        await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
        // Swap the data client first, so the guest screens' very first query hits the demo database.
        activateGuestData();
        setIsGuest(true);
      },

      async exitGuestMode() {
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
        deactivateGuestData();
        setIsGuest(false);
      },

      isGuest: status === 'guest',
      dataUserId: status === 'guest' ? GUEST_USER_ID : (session?.user.id ?? null),
      guestDataVersion,
      resetGuestData() {
        resetGuestStore();
        setGuestDataVersion((v) => v + 1);
      },

      async completeOnboarding() {
        if (!session?.user) return;
        await updateProfile(supabase, session.user.id, {
          onboarding_completed_at: new Date().toISOString(),
        });
        setOnboardingStatus('complete');
      },
    };
  }, [session, isGuest, hasLoadedOnce, isPasswordRecovery, onboardingStatus, guestDataVersion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export interface DataUser {
  /** Query with this id — real user's, or the fake guest's. Null until data can be loaded. */
  userId: string | null;
  /** True while the guest sample database is serving `supabase`. Use for copy/banners only, never to branch loading logic. */
  isGuest: boolean;
  /** True when it's safe to load and edit data: a fully signed-in user, or a guest. */
  isReady: boolean;
  /** Include in a load effect's deps to refetch after `resetGuestData()`. */
  guestDataVersion: number;
}

/**
 * The one hook a data-loading screen needs, so it can run identical code for
 * guests and signed-in users:
 *
 *   const { userId, isReady } = useDataUser();
 *   useEffect(() => {
 *     if (!isReady || !userId) return;
 *     listBillsWithPayments(supabase, userId).then(setBills);
 *   }, [isReady, userId]);
 *
 * Replaces the old `if (status !== 'signedIn' || !user) return` guard.
 */
export function useDataUser(): DataUser {
  const { status, dataUserId, isGuest, guestDataVersion } = useAuth();
  return {
    userId: dataUserId,
    isGuest,
    isReady: (status === 'signedIn' || status === 'guest') && dataUserId !== null,
    guestDataVersion,
  };
}
