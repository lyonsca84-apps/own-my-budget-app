import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 1234 cents -> "12.34", 1200 cents -> "12" — no trailing ".00" in an editable field. */
export function centsToInputText(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** "$1,234.5" -> 123450. Returns null for anything that isn't a non-negative amount. */
export function parseDollarsToCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export interface AmountInputProps {
  label: string;
  /** Screen-reader label — spell out what the amount is for ("Amount spent on Groceries in September 2026"). */
  accessibilityLabel: string;
  cents: number;
  editable?: boolean;
  /** Called on blur/submit with a valid amount in cents, or null if the field was left empty. */
  onCommit: (cents: number | null) => void;
  /** Shown in the field when there is no value (e.g. an amount that hasn't been typed yet). */
  placeholder?: string;
  showEmptyAsBlank?: boolean;
}

/**
 * Compact currency field for inline editing inside a list row. Holds its own
 * draft text while focused so typing is never overwritten by a data refresh,
 * then commits once on blur or submit.
 */
export function AmountInput({
  label,
  accessibilityLabel,
  cents,
  editable = true,
  onCommit,
  placeholder = '0',
  showEmptyAsBlank,
}: AmountInputProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const isFocused = draft !== null;

  function commit() {
    if (draft === null) return;
    const parsed = parseDollarsToCents(draft);
    setDraft(null);
    if (parsed === null) {
      if (draft.trim() === '') onCommit(null);
      return;
    }
    onCommit(parsed);
  }

  const shown = draft ?? (showEmptyAsBlank && cents === 0 ? '' : centsToInputText(cents));

  return (
    <View style={{ gap: Space[1], flexGrow: 1, flexBasis: 120, minWidth: 110 }}>
      <ThemedText type="small" themeColor="textSecondary" accessibilityElementsHidden>
        {label}
      </ThemedText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
          borderWidth: isFocused ? 2 : 1.5,
          borderColor: isFocused ? theme.primary : theme.controlBorder,
          borderRadius: Radius.input,
          paddingHorizontal: Space[3],
          backgroundColor: editable ? theme.backgroundElement : theme.backgroundSelected,
        }}
      >
        <ThemedText themeColor="textSecondary" accessibilityElementsHidden>
          $
        </ThemedText>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={shown}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          inputMode="decimal"
          selectTextOnFocus
          onFocus={() => setDraft(centsToInputText(cents) === '0' ? '' : centsToInputText(cents))}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          returnKeyType="done"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 40,
            paddingLeft: Space[1],
            textAlign: 'right',
            fontFamily: Fonts.body.semibold,
            fontSize: 17,
            color: theme.text,
          }}
        />
      </View>
    </View>
  );
}
