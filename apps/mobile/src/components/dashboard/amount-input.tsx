import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { centsToInputText, parseDollarsToCents } from '@/components/dashboard/format';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface AmountInputProps {
  /** Screen-reader label — spell out what the amount is for ("Amount spent on Groceries in September 2026"). */
  accessibilityLabel: string;
  cents: number;
  /** Called on blur/submit with a valid amount in cents, or null if the field was left empty. */
  onCommit: (cents: number | null) => void;
  /** `muted` is the gray-filled look the design gives the planned amount. */
  tone?: 'strong' | 'muted';
}

/**
 * Compact currency field for inline editing: "$" then a small right-aligned
 * number box. Holds its own draft while focused so typing is never
 * overwritten by a data refresh, then commits once on blur or submit.
 */
export function AmountInput({
  accessibilityLabel,
  cents,
  onCommit,
  tone = 'strong',
}: AmountInputProps) {
  const theme = useTheme();
  // `draft` is only set once the person actually types, so focusing never rewrites the field's text.
  const [draft, setDraft] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  function commit() {
    setIsFocused(false);
    if (draft === null) return;
    const parsed = parseDollarsToCents(draft);
    setDraft(null);
    if (parsed === null) {
      if (draft.trim() === '') onCommit(null);
      return;
    }
    onCommit(parsed);
  }

  const shown = draft ?? centsToInputText(cents);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[1] }}>
      <ThemedText type="small" themeColor="textSecondary" accessibilityElementsHidden>
        $
      </ThemedText>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={shown}
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
        inputMode="decimal"
        selectTextOnFocus
        onFocus={() => setIsFocused(true)}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
        style={{
          width: 76,
          minHeight: 44,
          paddingHorizontal: Space[3],
          borderWidth: isFocused ? 2 : 1.5,
          borderColor: isFocused ? theme.primary : theme.controlBorder,
          borderRadius: Radius.input,
          backgroundColor:
            tone === 'muted' && !isFocused ? theme.background : theme.backgroundElement,
          textAlign: 'right',
          fontFamily: tone === 'strong' ? Fonts.body.bold : Fonts.body.semibold,
          fontSize: 15,
          color: tone === 'strong' ? theme.text : theme.textSecondary,
        }}
      />
    </View>
  );
}
