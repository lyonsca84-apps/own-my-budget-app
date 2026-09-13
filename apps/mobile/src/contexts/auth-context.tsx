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

import { supabase } from '@/lib/supabase';

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

export type AuthStatus = 'loading' | 'signedOut' | 'guest' | 'signedIn' | 'passwordRecovery';

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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const [{ data }, storedGuestFlag] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(GUEST_MODE_KEY),
      ]);
      if (!isMounted) return;
      setSession(data.session);
      setIsGuest(storedGuestFlag === 'true' && !data.session);
      setHasLoadedOnce(true);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // A real sign-in always wins over a lingering guest flag.
      if (nextSession) setIsGuest(false);
      // Clicking the password-reset email link creates a real session, but
      // it must land on the "set a new password" screen, not the tab shell
      // — this event is Supabase's signal that's exactly what happened.
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
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
          ? 'signedIn'
          : isGuest
            ? 'guest'
            : 'signedOut';

    return {
      status,
      session,
      user: session?.user ?? null,

      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },

      async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: oauthRedirectOptions(),
        });
        return { error: error?.message ?? null };
      },

      async signInWithApple() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: oauthRedirectOptions(),
        });
        return { error: error?.message ?? null };
      },

      async signOut() {
        await supabase.auth.signOut();
      },

      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        return { error: error?.message ?? null };
      },

      async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (!error) setIsPasswordRecovery(false);
        return { error: error?.message ?? null };
      },

      async continueAsGuest() {
        await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
        setIsGuest(true);
      },

      async exitGuestMode() {
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
        setIsGuest(false);
      },
    };
  }, [session, isGuest, hasLoadedOnce, isPasswordRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
