import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanSummary } from './use-bills-debt-data';

/**
 * "Assigned to paycheck: $250.00 across 2 paychecks" / "Assigned to paycheck:
 * Not yet assigned to a paycheck" — the design's link-colored line under
 * every card, loan and bill. Words, not just color.
 */
export function PlanLine({
  plan,
  label = 'Assigned to paycheck',
}: {
  plan?: PlanSummary;
  label?: string;
}) {
  const assigned = plan && plan.paydayCount > 0;
  return (
    <ThemedText type="smallBold" themeColor="solidAccent">
      {label}:{' '}
      {assigned
        ? `${formatCents(plan.totalCents)} across ${plan.paydayCount} ${
            plan.paydayCount === 1 ? 'paycheck' : 'paychecks'
          }`
        : 'Not yet assigned to a paycheck'}
    </ThemedText>
  );
}

/** Outlined destructive action ("Delete card"); the real confirmation happens inline in ConfirmRemove. */
export function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      label={label}
      variant="dangerOutline"
      size="sm"
      shape="rounded"
      accessibilityLabel={label}
      onPress={onPress}
    />
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
        backgroundColor: theme.clayMuted,
      }}
    >
      <ThemedText type="smallBold">Delete {name}?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        This takes the {noun} off your lists. Your payment history is kept.
      </ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
        <Button label="Keep it" variant="soft" size="sm" shape="rounded" onPress={onCancel} />
        <Button
          label={`Yes, delete ${noun}`}
          variant="danger"
          size="sm"
          shape="rounded"
          onPress={onConfirm}
        />
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

/** Whole-dollar display ("$1,481") for big figures on cards and tiles, where the design drops cents. */
export function formatWholeDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
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

/**
 * Measures the width available to a block, so grids can pick their column
 * count from the space they actually get (the sidebar takes 264px on wide
 * web) instead of the window width. `width` is 0 until first layout.
 */
export function useMeasuredWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (event) => setWidth(Math.round(event.nativeEvent.layout.width))];
}

/**
 * A grid of equal-width cells whose column count comes from the measured
 * width: `minCell` is the narrowest a cell may get, `maxColumns` the widest
 * the design allows (5 for summary tiles, 3 for the per-card grid).
 */
export function ResponsiveGrid({
  children,
  minCell,
  maxColumns,
  gap = Space[3],
  align = 'stretch',
}: {
  children: ReactNode[];
  minCell: number;
  maxColumns: number;
  gap?: number;
  align?: 'stretch' | 'flex-start' | 'flex-end';
}) {
  const [width, onLayout] = useMeasuredWidth();
  const columns =
    width > 0 ? Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minCell + gap)))) : 1;
  const cell = width > 0 ? (width - gap * (columns - 1)) / columns : undefined;
  return (
    <View
      onLayout={onLayout}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: align }}
    >
      {width > 0
        ? children.map((child, index) => (
            <View key={index} style={{ width: cell, minWidth: 0 }}>
              {child}
            </View>
          ))
        : null}
    </View>
  );
}
