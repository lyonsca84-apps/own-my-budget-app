import { useEffect, useState, useSyncExternalStore } from 'react';
import { getProfile, getProfileImageUrl } from '@own-my-budget/api';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * Signed, short-lived links for the signed-in user's own profile photo and
 * household/business logo (private `profile-images` bucket). Any screen that
 * changes them calls `notifyProfileImagesChanged()` so every avatar refreshes.
 */

let version = 0;
const listeners = new Set<() => void>();

export function notifyProfileImagesChanged(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface ProfileImages {
  avatarPath: string | null;
  logoPath: string | null;
  avatarUrl: string | null;
  logoUrl: string | null;
}

const EMPTY: ProfileImages = { avatarPath: null, logoPath: null, avatarUrl: null, logoUrl: null };

export function useProfileImages(): ProfileImages {
  const { status, user } = useAuth();
  const current = useSyncExternalStore(subscribe, () => version);
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;
  const [loaded, setLoaded] = useState<{ key: string; images: ProfileImages } | null>(null);
  const key = `${userId}:${current}`;

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    (async () => {
      const profile = await getProfile(supabase, userId);
      // Columns are absent until the profile-images migration is applied.
      const avatarPath = (profile as { avatar_path?: string | null }).avatar_path ?? null;
      const logoPath = (profile as { logo_path?: string | null }).logo_path ?? null;
      const [avatarUrl, logoUrl] = await Promise.all([
        avatarPath ? getProfileImageUrl(supabase, avatarPath) : null,
        logoPath ? getProfileImageUrl(supabase, logoPath) : null,
      ]);
      if (isMounted) setLoaded({ key, images: { avatarPath, logoPath, avatarUrl, logoUrl } });
    })().catch(() => {
      if (isMounted) setLoaded({ key, images: EMPTY });
    });
    return () => {
      isMounted = false;
    };
  }, [userId, key]);

  return userId && loaded ? loaded.images : EMPTY;
}
