import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Fonts, Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanSummary } from './use-bills-debt-data';

/** "Assigned to paycheck: $250.00 across 2 paychecks" / "Not yet assigned to a paycheck". */
export function PlanLine({
  plan,
  label = 'Assigned to paycheck',
}: {
  plan?: PlanSummary;
  label?: string;
}) {
  if (!plan || plan.paydayCount === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Not yet assigned to a paycheck
      </ThemedText>
    );
  }
  return (
    <ThemedText type="smallBold" themeColor="primary">
      {label}: {formatCents(plan.totalCents)} across {plan.paydayCount}{' '}
      {plan.paydayCount === 1 ? 'paycheck' : 'paychecks'}
    </ThemedText>
  );
}

/**
 * Outlined destructive-looking action. Uses the theme's danger color as a
 * text + border cue (with its own label — never color alone); the actual
 * confirmation happens inline in ConfirmRemove.
 */
export function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: Layout.minimumTouchTarget,
        borderRadius: Radius.full,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: theme.danger,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <ThemedText
        style={{
          color: theme.danger,
          fontFamily: Fonts.body.semibold,
          fontSize: 17,
          lineHeight: 24,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Inline "are you sure?" — Alert.alert with buttons is a no-op on web, so a
 * destructive action asks in place instead, on every platform.
 */
export function ConfirmRemove({
  name,
  noun,
  onCancel,
  onConfirm,
}: {
  name: string;
  noun: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        gap: Space[3],
        padding: Space[4],
        borderRadius: Radius.smallCard,
        backgroundColor: theme.backgroundSelected,
      }}
    >
      <ThemedText type="smallBold">Remove {name}?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        This takes the {noun} off your lists. Your payment history is kept, and you can always add
        it again.
      </ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
        <Button label="Keep it" variant="secondary" onPress={onCancel} />
        <DangerButton label={`Remove ${noun}`} onPress={onConfirm} />
      </View>
    </View>
  );
}

/** A small "Paid off" affirmation chip — text plus a check, not just color. */
export function PaidOffChip() {
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.successMuted,
        borderRadius: Radius.full,
        paddingVertical: 4,
        paddingHorizontal: Space[3],
      }}
    >
      <ThemedText type="smallBold" themeColor="success">
        ✓ Paid off
      </ThemedText>
    </View>
  );
}

export function formatDollarsInput(cents: number | null): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

/** Parses a typed dollar amount into cents; null for empty/invalid. */
export function parseDollarsToCents(text: string): number | null {
  const value = parseFloat(text.replace(/[$,\s]/g, ''));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

/** Semibold body-size title for list rows and card headings (ThemedText has no built-in "label" type). */
export function LabelText({ children }: { children: ReactNode }) {
  return <ThemedText style={{ fontFamily: Fonts.body.semibold }}>{children}</ThemedText>;
}

/**
 * A text field's draft that re-syncs whenever the saved value changes (e.g. a
 * reload) — done during render rather than in an effect, so there's no extra
 * render pass and no stale flash.
 */
export function useSyncedText(source: string): [string, (value: string) => void] {
  const [previous, setPrevious] = useState(source);
  const [text, setText] = useState(source);
  if (previous !== source) {
    setPrevious(source);
    setText(source);
  }
  return [text, setText];
}
