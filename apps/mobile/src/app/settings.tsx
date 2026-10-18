import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import {
  getCurrentAccount,
  getProfile,
  removeProfileImage,
  updateProfile,
  uploadProfileImage,
} from '@own-my-budget/api';
import {
  AGE_RANGES,
  ONBOARDING_NAME_MAX_LENGTH,
  TIER_LABELS,
  isAgeRange,
  validateProfileImage,
  type PlanTier,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Layout, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTour } from '@/contexts/tour-context';
import { useTheme } from '@/hooks/use-theme';
import { notifyProfileImagesChanged, useProfileImages } from '@/lib/profile-images';
import { supabase } from '@/lib/supabase';

type SectionId = 'profile' | 'preferences' | 'notifications' | 'security' | 'subscription' | 'help';

const SECTIONS: { id: SectionId; label: string; blurb: string }[] = [
  { id: 'profile', label: 'Profile', blurb: 'Your name, photo and optional details.' },
  { id: 'preferences', label: 'Preferences', blurb: 'Motion and the guided tour.' },
  { id: 'notifications', label: 'Notifications', blurb: 'Bill reminders.' },
  { id: 'security', label: 'Security & Privacy', blurb: 'Password, your data, sign out.' },
  { id: 'subscription', label: 'Subscription & Plan', blurb: 'Your plan and billing.' },
  { id: 'help', label: 'Help & Legal', blurb: 'Help, disclaimer, privacy and terms.' },
];

const isSection = (value: unknown): value is SectionId => SECTIONS.some((s) => s.id === value);

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Email and password',
  google: 'Google',
  apple: 'Apple',
};

/** Friendly message for a failed save/upload, including "not set up yet" on the server. */
function describeError(error: unknown, action: string): string {
  const text =
    error instanceof Error
      ? error.message
      : String((error as { message?: string } | null)?.message ?? '');
  if (/bucket not found|column .* does not exist|PGRST204|schema cache/i.test(text)) {
    return `${action} needs a quick server update before it can be saved. Please try again later.`;
  }
  return `We couldn’t ${action.charAt(0).toLowerCase()}${action.slice(1)} just now. Please try again.`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Web: confirm the browser can actually decode the image. */
function canDecode(dataUri: string): Promise<boolean> {
  if (Platform.OS !== 'web') return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = dataUri;
  });
}

/**
 * Settings: a section menu and one content panel (stacked on narrow
 * screens). Profile edits use Save changes / Cancel; photo and logo uploads
 * save on their own. Every other section uses the existing screens.
 */
export default function SettingsScreen() {
  const { status, user, signOut, exitGuestMode } = useAuth();
  const isGuest = status === 'guest';
  const { width } = useWindowDimensions();
  const isWide = width >= Layout.sidebarBreakpoint;
  const theme = useTheme();

  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<SectionId>(
    isSection(params.section) ? params.section : 'profile'
  );
  const [lastParam, setLastParam] = useState(params.section);
  if (params.section !== lastParam) {
    setLastParam(params.section);
    if (isSection(params.section)) setSection(params.section);
  }

  const profile = useProfileForm();

  if (isGuest) {
    return (
      <Screen>
        <Card style={{ gap: Space[3] }}>
          <ThemedText type="subtitle">Settings</ThemedText>
          <ThemedText themeColor="textSecondary">
            You’re exploring with sample data. Create an account to have a profile and settings.
          </ThemedText>
          <Button
            label="Create an account"
            variant="panel"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              exitGuestMode();
              router.replace('/sign-up');
            }}
          />
        </Card>
      </Screen>
    );
  }

  const showSaveBar = section === 'profile' && profile.dirty;

  return (
    <Screen contentStyle={{ maxWidth: 1120 }}>
      {/* Page heading, with Save / Cancel only while Profile has unsaved edits */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: Space[3],
        }}
      >
        <View style={{ gap: Space[1], flexShrink: 1 }}>
          <ThemedText type="title" accessibilityRole="header">
            Settings
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Manage your profile, preferences, plan and privacy.
          </ThemedText>
        </View>
        {showSaveBar ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button label="Cancel" variant="outline" onPress={profile.requestCancel} />
            <Button
              label={profile.saving ? 'Saving…' : 'Save changes'}
              variant="panel"
              onPress={profile.save}
              disabled={profile.saving || !profile.valid}
            />
          </View>
        ) : null}
      </View>

      {profile.confirmingCancel ? (
        <Card style={{ gap: Space[3], borderColor: theme.warning, borderWidth: 1.5 }}>
          <ThemedText accessibilityRole="alert">Discard your unsaved profile changes?</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button label="Discard changes" variant="outline" onPress={profile.discard} />
            <Button label="Keep editing" variant="quiet" onPress={profile.keepEditing} />
          </View>
        </Card>
      ) : null}

      <View
        style={{
          flexDirection: isWide ? 'row' : 'column',
          alignItems: 'flex-start',
          gap: Space[5],
        }}
      >
        {/* Section menu */}
        <View
          accessibilityRole="tablist"
          aria-label="Settings sections"
          style={
            isWide
              ? { width: 240, gap: Space[1] }
              : { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], alignSelf: 'stretch' }
          }
        >
          {SECTIONS.map((item) => {
            const selected = item.id === section;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.label}. ${item.blurb}`}
                onPress={() => setSection(item.id)}
                style={({ pressed }) => ({
                  minHeight: Layout.minimumTouchTarget,
                  justifyContent: 'center',
                  paddingHorizontal: Space[4],
                  paddingVertical: Space[2],
                  borderRadius: Radius.input,
                  backgroundColor: selected
                    ? theme.primaryMuted
                    : pressed
                      ? theme.backgroundSelected
                      : isWide
                        ? 'transparent'
                        : theme.backgroundElement,
                  borderWidth: isWide ? 0 : 1,
                  borderColor: theme.border,
                })}
              >
                <ThemedText
                  type="smallBold"
                  themeColor={selected ? 'primary' : 'text'}
                  style={{ fontSize: 16 }}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Content panel (Profile stays mounted so its draft survives switching sections) */}
        <Card style={{ flex: isWide ? 1 : undefined, alignSelf: 'stretch', gap: Space[5] }}>
          <View style={{ display: section === 'profile' ? 'flex' : 'none', gap: Space[5] }}>
            <ProfilePanel form={profile} isWide={isWide} email={user?.email ?? null} />
          </View>
          {section === 'preferences' ? <PreferencesPanel /> : null}
          {section === 'notifications' ? <NotificationsPanel /> : null}
          {section === 'security' ? <SecurityPanel onSignOut={() => signOut()} /> : null}
          {section === 'subscription' ? <SubscriptionPanel /> : null}
          {section === 'help' ? <HelpPanel /> : null}
        </Card>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Profile form state (shared with the page header's Save / Cancel)
// ---------------------------------------------------------------------------

function useProfileForm() {
  const { status, user } = useAuth();
  const [saved, setSaved] = useState<{ name: string; age: string } | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  useEffect(() => {
    if (!user || status !== 'signedIn') return;
    let isMounted = true;
    getProfile(supabase, user.id)
      .then((profile) => {
        if (!isMounted) return;
        // 'there' is the column default ("Hi there"), not a name the user chose.
        const current =
          profile.display_name && profile.display_name !== 'there' ? profile.display_name : '';
        const ageRange = (profile as { age_range?: string | null }).age_range ?? '';
        setSaved({ name: current, age: ageRange });
        setName(current);
        setAge(ageRange);
        setMemberSince(profile.created_at);
      })
      .catch(() => {
        if (isMounted) setLoadError(true);
      });
    return () => {
      isMounted = false;
    };
  }, [user, status]);

  const trimmed = name.trim();
  const dirty = saved !== null && (trimmed !== saved.name || age !== saved.age);
  const nameError =
    saved !== null && trimmed.length === 0 && saved.name.length > 0
      ? 'Enter a name, or Cancel to keep your current one.'
      : null;
  const valid = !nameError && (age === '' || isAgeRange(age));

  const save = useCallback(async () => {
    if (!user || !saved || !dirty || !valid) return;
    setSaving(true);
    setMessage(null);
    // Only what changed is written; everything else on the profile stays as it is.
    const changes: { display_name?: string; age_range?: string | null } = {};
    if (trimmed !== saved.name && trimmed) changes.display_name = trimmed;
    if (age !== saved.age) changes.age_range = age || null;
    try {
      await updateProfile(supabase, user.id, changes);
      setSaved({ name: trimmed || saved.name, age });
      setName(trimmed || saved.name);
      setMessage({ text: 'Saved.', tone: 'success' });
    } catch (error) {
      setMessage({ text: describeError(error, 'Save your profile'), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [user, saved, dirty, valid, trimmed, age]);

  return {
    loadError,
    name,
    setName: (value: string) => {
      setName(value);
      setMessage(null);
    },
    age,
    setAge: (value: string) => {
      setAge(value);
      setMessage(null);
    },
    memberSince,
    nameError,
    dirty,
    valid,
    saving,
    message,
    save,
    confirmingCancel,
    requestCancel: () => setConfirmingCancel(true),
    keepEditing: () => setConfirmingCancel(false),
    discard: () => {
      if (saved) {
        setName(saved.name);
        setAge(saved.age);
      }
      setConfirmingCancel(false);
      setMessage(null);
    },
  };
}

type ProfileForm = ReturnType<typeof useProfileForm>;

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function PanelHeading({ title, blurb }: { title: string; blurb: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: Space[1],
        paddingBottom: Space[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <ThemedText type="subtitle" accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{blurb}</ThemedText>
    </View>
  );
}

function FieldGrid({ isWide, children }: { isWide: boolean; children: ReactNode }) {
  return (
    <View style={{ flexDirection: isWide ? 'row' : 'column', flexWrap: 'wrap', gap: Space[4] }}>
      {children}
    </View>
  );
}

function GridCell({ isWide, children }: { isWide: boolean; children: ReactNode }) {
  return <View style={isWide ? { flexBasis: 280, flexGrow: 1 } : undefined}>{children}</View>;
}

function ProfilePanel({
  form,
  isWide,
  email,
}: {
  form: ProfileForm;
  isWide: boolean;
  email: string | null;
}) {
  const { user } = useAuth();
  const images = useProfileImages();
  const displayName = form.name.trim() || user?.email?.split('@')[0] || 'You';
  const providers = Array.from(new Set((user?.identities ?? []).map((i) => i.provider)));

  return (
    <>
      <PanelHeading
        title="Profile"
        blurb="Only what helps personalize Own My Budget. Your budget numbers live in their own sections."
      />

      {form.loadError ? (
        <ThemedText themeColor="danger" accessibilityRole="alert">
          We couldn’t load your profile. Please try again in a moment.
        </ThemedText>
      ) : null}

      <ImageControl
        kind="avatar"
        first
        title="Profile photo"
        help="Optional. Shown on your avatar in the app. PNG, JPG or WebP, up to 5 MB."
        currentUrl={images.avatarUrl}
        hasImage={images.avatarPath !== null}
        preview={(uri) => <Avatar name={displayName} size={72} imageUri={uri} />}
      />

      <View style={{ gap: Space[3] }}>
        <ThemedText type="smallBold">Personal information</ThemedText>
        <FieldGrid isWide={isWide}>
          <GridCell isWide={isWide}>
            <TextField
              label="Display name"
              value={form.name}
              onChangeText={form.setName}
              maxLength={ONBOARDING_NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoComplete="given-name"
              errorMessage={form.nameError ?? undefined}
              helperText="Editable. A first name or nickname is fine."
            />
          </GridCell>
          <GridCell isWide={isWide}>
            <View style={{ gap: Space[1] }}>
              <ThemedText type="smallBold">Email</ThemedText>
              <ThemedText style={{ paddingVertical: Space[2] }}>
                {email ?? 'Not available'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Read-only. This is the address you sign in with.
              </ThemedText>
            </View>
          </GridCell>
          <GridCell isWide={isWide}>
            <SelectField
              label="Age range (optional)"
              value={form.age}
              onChange={form.setAge}
              placeholder="Prefer not to say"
              options={[
                { value: '', label: 'Prefer not to say' },
                ...AGE_RANGES.map((range) => ({ value: range.value, label: range.label })),
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Space[1] }}>
              Helps us suggest learning content and Budget Missions that fit your stage of life. It
              never limits what you can use, and you can clear it anytime.
            </ThemedText>
          </GridCell>
          <GridCell isWide={isWide}>
            <View style={{ gap: Space[1] }}>
              <ThemedText type="smallBold">Sign-in</ThemedText>
              <ThemedText>
                {providers.length > 0
                  ? providers.map((p) => PROVIDER_LABEL[p] ?? p).join(', ')
                  : 'Not available'}
              </ThemedText>
              {form.memberSince ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Member since{' '}
                  {new Date(form.memberSince).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </ThemedText>
              ) : null}
            </View>
          </GridCell>
        </FieldGrid>
        {form.message ? (
          <ThemedText
            themeColor={form.message.tone}
            accessibilityRole={form.message.tone === 'danger' ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
          >
            {form.message.text}
          </ThemedText>
        ) : form.dirty ? (
          <ThemedText type="small" themeColor="textSecondary">
            You have unsaved changes. Use Save changes at the top of the page.
          </ThemedText>
        ) : null}
      </View>

      <ImageControl
        kind="logo"
        title="Household or business logo"
        help="Optional. Shown only in your own profile; it never replaces the Own My Budget logo. PNG, JPG or WebP, up to 5 MB."
        currentUrl={images.logoUrl}
        hasImage={images.logoPath !== null}
        preview={(uri) =>
          uri ? (
            <Image
              source={{ uri }}
              accessibilityLabel="Your household or business logo"
              style={{ width: 120, height: 72, borderRadius: Radius.input }}
              contentFit="contain"
            />
          ) : null
        }
      />
    </>
  );
}

/** Upload / Replace / Remove for the profile photo or the logo. Saves on its own. */
function ImageControl({
  kind,
  title,
  help,
  currentUrl,
  hasImage,
  preview,
  first,
}: {
  kind: 'avatar' | 'logo';
  /** The first block under the panel heading draws no extra divider. */
  first?: boolean;
  title: string;
  help: string;
  currentUrl: string | null;
  hasImage: boolean;
  preview: (uri: string | null) => ReactNode;
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const [busy, setBusy] = useState<'uploading' | 'removing' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const noun = kind === 'avatar' ? 'photo' : 'logo';

  async function pick() {
    if (!user || busy) return;
    setMessage(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const base64 =
      asset.base64 ?? (asset.uri.startsWith('data:') ? (asset.uri.split(',')[1] ?? null) : null);
    if (!base64) {
      setMessage({ text: 'We couldn’t read that file. Please try another image.', tone: 'danger' });
      return;
    }
    const bytes = base64ToBytes(base64);
    const check = validateProfileImage({
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
      bytes,
    });
    if (!check.ok) {
      setMessage({ text: check.message, tone: 'danger' });
      return;
    }
    if (!(await canDecode(`data:${check.contentType};base64,${base64}`))) {
      setMessage({ text: 'That image couldn’t be opened. Please try another.', tone: 'danger' });
      return;
    }
    setBusy('uploading');
    try {
      await uploadProfileImage(supabase, user.id, kind, bytes, check.contentType, check.extension);
      notifyProfileImagesChanged();
      setMessage({ text: `Your ${noun} is saved.`, tone: 'success' });
    } catch (error) {
      setMessage({ text: describeError(error, `Upload your ${noun}`), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!user || busy) return;
    setConfirmRemove(false);
    setBusy('removing');
    setMessage(null);
    try {
      await removeProfileImage(supabase, user.id, kind);
      notifyProfileImagesChanged();
      setMessage({ text: `Your ${noun} was removed.`, tone: 'success' });
    } catch (error) {
      setMessage({ text: describeError(error, `Remove your ${noun}`), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <View
      style={{
        gap: Space[3],
        paddingTop: first ? 0 : Space[4],
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}
    >
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[4] }}>
        {preview(currentUrl)}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
          <Button
            label={
              busy === 'uploading' ? 'Uploading…' : hasImage ? `Replace ${noun}` : `Upload ${noun}`
            }
            variant="panel"
            size="sm"
            onPress={() => void pick()}
            disabled={busy !== null}
            loading={busy === 'uploading'}
          />
          {hasImage ? (
            <Button
              label={busy === 'removing' ? 'Removing…' : 'Remove'}
              variant="outline"
              size="sm"
              onPress={() => setConfirmRemove(true)}
              disabled={busy !== null}
            />
          ) : null}
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {help}
      </ThemedText>
      {confirmRemove ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] }}
        >
          <ThemedText>Remove your {noun}?</ThemedText>
          <Button
            label={`Remove ${noun}`}
            variant="dangerOutline"
            size="sm"
            onPress={() => void remove()}
          />
          <Button
            label="Keep it"
            variant="quiet"
            size="sm"
            onPress={() => setConfirmRemove(false)}
          />
        </View>
      ) : null}
      {message ? (
        <ThemedText
          themeColor={message.tone}
          accessibilityRole={message.tone === 'danger' ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </ThemedText>
      ) : null}
    </View>
  );
}

function LinkRow({ label, hint, href }: { label: string; hint: string; href: Href }) {
  return (
    <View style={{ gap: Space[1] }}>
      <Button
        label={label}
        variant="secondary"
        style={{ alignSelf: 'flex-start' }}
        accessibilityLabel={`${label}. ${hint}`}
        onPress={() => router.push(href)}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {hint}
      </ThemedText>
    </View>
  );
}

function PreferencesPanel() {
  const tour = useTour();
  return (
    <>
      <PanelHeading title="Preferences" blurb="How Own My Budget looks and guides you." />
      <View style={{ gap: Space[1] }}>
        <ThemedText type="smallBold">Motion</ThemedText>
        <ThemedText themeColor="textSecondary">
          Animations, including Budget Buddy’s, follow your device’s reduce-motion setting.
        </ThemedText>
      </View>
      <View style={{ gap: Space[2] }}>
        <ThemedText type="smallBold">Guided tour</ThemedText>
        <ThemedText themeColor="textSecondary">
          Budget Buddy walks you through each part of the app again. Your saved budget stays as it
          is.
        </ThemedText>
        <Button
          label="Take the tour again"
          variant="secondary"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => tour.start({ replay: true })}
        />
      </View>
    </>
  );
}

function NotificationsPanel() {
  return (
    <>
      <PanelHeading title="Notifications" blurb="Reminders the app can send you." />
      <LinkRow
        label="Bill reminders"
        hint="Turn reminders on or off and choose how many days before a bill is due."
        href="/notification-settings"
      />
    </>
  );
}

function SecurityPanel({ onSignOut }: { onSignOut: () => void }) {
  return (
    <>
      <PanelHeading title="Security & Privacy" blurb="Sign-in, your data, and signing out." />
      <LinkRow label="Password & security" hint="Change your password." href="/security" />
      <LinkRow
        label="Data & privacy"
        hint="What we store, export your data, or permanently delete your account."
        href="/data-privacy"
      />
      <View style={{ gap: Space[1] }}>
        <Button
          label="Log out"
          variant="outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={onSignOut}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Signs you out on this device.
        </ThemedText>
      </View>
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Free trial',
  past_due: 'Payment issue',
  canceled: 'Canceled',
};

function SubscriptionPanel() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<{ tier: PlanTier; status: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    getCurrentAccount(supabase, user.id)
      .then((account) => {
        if (isMounted) {
          setPlan({
            tier: account.entitlement.plan_tier as PlanTier,
            status: account.entitlement.status,
          });
        }
      })
      .catch(() => {
        if (isMounted) setError(true);
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <>
      <PanelHeading
        title="Subscription & Plan"
        blurb="Your plan comes from Stripe through your account. Opening this page never changes it."
      />
      {error ? (
        <ThemedText themeColor="danger" accessibilityRole="alert">
          We couldn’t load your plan just now.
        </ThemedText>
      ) : plan ? (
        <ThemedText>
          {TIER_LABELS[plan.tier]} · {STATUS_LABEL[plan.status] ?? plan.status}
        </ThemedText>
      ) : (
        <ThemedText themeColor="textSecondary">Loading your plan…</ThemedText>
      )}
      <LinkRow
        label="Subscription & plan"
        hint="Price, renewal date, and Stripe’s secure page to change your plan, update payment, see invoices or cancel."
        href="/subscription"
      />
    </>
  );
}

function HelpPanel() {
  return (
    <>
      <PanelHeading title="Help & Legal" blurb="Answers, and the documents that apply to you." />
      <LinkRow
        label="Help, FAQ & legal"
        hint="Help and FAQ, the educational disclaimer, Privacy Policy and Terms of Service."
        href="/help-legal"
      />
      <ThemedText type="small" themeColor="textSecondary">
        Own My Budget provides educational budgeting tools and general information, not financial
        advice.
      </ThemedText>
    </>
  );
}
