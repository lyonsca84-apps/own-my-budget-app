import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface DialogScreenProps {
  /** Dialog heading, e.g. "Plan payment — Rent". Also the accessible name. */
  title: string;
  subtitle?: string;
  /** Called by Cancel / backdrop click / Escape. Defaults to going back (or to the dashboard if there's no history). */
  onClose?: () => void;
  /** Label of the filled primary action ("Save plan"). Omit for a dialog with no primary action. */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  /** Shows a spinner in the primary button and blocks double-submits. */
  busy?: boolean;
  /** Label of the gray secondary button; default "Cancel". Pass `null` to hide it. */
  secondaryLabel?: string | null;
  /** Error text drawn in clay above the footer (validation / save failures). */
  errorMessage?: string | null;
  /** Replaces the default Cancel + primary footer entirely (e.g. a destructive action on the left). */
  footer?: ReactNode;
  /** `md` = 560px card, `lg` = 720px (long forms, the 52-week challenge). Ignored on native / narrow web. */
  size?: 'md' | 'lg';
  /** The dialog body. Scrolls when it's taller than the window; the footer stays put. */
  children: ReactNode;
}

/** Default close behavior shared by every dialog: pop the route, or land on the dashboard when opened cold. */
export function closeDialogRoute() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** The Cancel + primary button row. Used by both the sheet and the wide web card. */
export function DialogFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  busy,
  secondaryLabel = 'Cancel',
  onClose,
  footer,
}: Pick<
  DialogScreenProps,
  | 'primaryLabel'
  | 'onPrimary'
  | 'primaryDisabled'
  | 'busy'
  | 'secondaryLabel'
  | 'onClose'
  | 'footer'
>) {
  if (footer) return <View style={{ flexDirection: 'row', gap: Space[3] }}>{footer}</View>;
  return (
    <View style={{ flexDirection: 'row', gap: Space[3] }}>
      {secondaryLabel === null ? null : (
        <Button
          label={secondaryLabel}
          variant="soft"
          shape="rounded"
          disabled={busy}
          onPress={onClose ?? closeDialogRoute}
          style={{ flex: 1 }}
        />
      )}
      {primaryLabel ? (
        <Button
          label={primaryLabel}
          variant="primary"
          shape="rounded"
          disabled={primaryDisabled}
          loading={busy}
          onPress={onPrimary}
          style={{ flex: 1 }}
        />
      ) : null}
    </View>
  );
}

/** Errors, drawn once so the sheet and the card match. */
export function DialogError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <ThemedText type="smallBold" themeColor="clay" accessibilityRole="alert">
      {message}
    </ThemedText>
  );
}

/**
 * Native + narrow-web presentation: a full-height sheet under the standard
 * navigation header (which shows `title`), scrolling body, sticky footer.
 */
export function DialogSheet({
  title,
  subtitle,
  children,
  errorMessage,
  ...footerProps
}: DialogScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Space[5], gap: Space[4], flexGrow: 1 }}
        >
          {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
          {children}
        </ScrollView>
        <View
          style={{
            gap: Space[3],
            paddingHorizontal: Space[5],
            paddingTop: Space[3],
            paddingBottom: Math.max(insets.bottom, Space[3]),
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.backgroundElement,
          }}
        >
          <DialogError message={errorMessage} />
          <DialogFooter {...footerProps} />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
