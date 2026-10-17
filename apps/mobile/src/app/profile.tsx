import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { getProfile, updateProfile } from '@own-my-budget/api';
import { ONBOARDING_NAME_MAX_LENGTH } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Email and password',
  google: 'Google',
  apple: 'Apple',
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The signed-in user's profile, from the existing `profiles` row and auth
 * session (no second profile). Only the display name is editable here; the
 * sign-in email is managed by the auth provider and shown read-only.
 */
export default function ProfileScreen() {
  const { status, user } = useAuth();
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user || status !== 'signedIn') return;
      let isMounted = true;
      getProfile(supabase, user.id)
        .then((profile) => {
          if (!isMounted) return;
          // 'there' is the column default ("Hi there"), not a name the user chose.
          const current =
            profile.display_name && profile.display_name !== 'there' ? profile.display_name : '';
          setName(current);
          setSavedName(current);
          setMemberSince(profile.created_at);
          setLoadError(false);
        })
        .catch(() => {
          if (isMounted) setLoadError(true);
        });
      return () => {
        isMounted = false;
      };
    }, [user, status])
  );

  if (status === 'guest') {
    return (
      <Screen>
        <SectionCard title="Profile">
          <ThemedText>
            You’re exploring with sample data. Create an account to have a profile.
          </ThemedText>
        </SectionCard>
      </Screen>
    );
  }

  const trimmed = name.trim();
  const canSave = !isSaving && !loadError && trimmed.length > 0 && trimmed !== savedName;
  // Linked identities are the source of truth for how this account can sign in.
  const providers = Array.from(
    new Set(
      (user?.identities ?? []).map((identity) => identity.provider).length > 0
        ? (user?.identities ?? []).map((identity) => identity.provider)
        : ((user?.app_metadata?.providers as string[] | undefined) ?? [])
    )
  );

  async function handleSave() {
    if (!user || !canSave) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile(supabase, user.id, { display_name: trimmed });
      setSavedName(updated.display_name ?? trimmed);
      setName(updated.display_name ?? trimmed);
      setMessage({ text: 'Saved. Your dashboard will greet you by this name.', tone: 'success' });
    } catch {
      setMessage({
        text: 'We couldn’t save your name just now. Please try again.',
        tone: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      {loadError ? (
        <ThemedText themeColor="danger" accessibilityRole="alert">
          We couldn’t load your profile. Please try again in a moment.
        </ThemedText>
      ) : null}

      <SectionCard title="Your name">
        <TextField
          label="Display name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setMessage(null);
          }}
          maxLength={ONBOARDING_NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoComplete="given-name"
          helperText="Editable. A first name or nickname is fine; we use it to say hello."
        />
        {message ? (
          <ThemedText
            themeColor={message.tone}
            accessibilityRole={message.tone === 'danger' ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
          >
            {message.text}
          </ThemedText>
        ) : null}
        <Button
          label={isSaving ? 'Saving…' : 'Save name'}
          variant="panel"
          onPress={handleSave}
          disabled={!canSave}
        />
      </SectionCard>

      <SectionCard title="Sign-in">
        <View style={{ gap: Space[1] }}>
          <ThemedText type="smallBold">Email</ThemedText>
          <ThemedText>{user?.email ?? 'Not available'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Read-only. This is the address you sign in with.
          </ThemedText>
        </View>
        {providers.length > 0 ? (
          <View style={{ gap: Space[1] }}>
            <ThemedText type="smallBold">Sign-in methods</ThemedText>
            <ThemedText>{providers.map((p) => PROVIDER_LABEL[p] ?? p).join(', ')}</ThemedText>
          </View>
        ) : null}
        {memberSince ? (
          <View style={{ gap: Space[1] }}>
            <ThemedText type="smallBold">Member since</ThemedText>
            <ThemedText>{longDate(memberSince)}</ThemedText>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Account">
        <View style={{ gap: Space[3] }}>
          <Button
            label="Subscription & billing"
            variant="secondary"
            onPress={() => router.push('/subscription')}
          />
          <Button
            label="Password & security"
            variant="secondary"
            onPress={() => router.push('/security')}
          />
          <Button
            label="Data & privacy"
            variant="secondary"
            onPress={() => router.push('/data-privacy')}
          />
        </View>
      </SectionCard>
    </Screen>
  );
}
