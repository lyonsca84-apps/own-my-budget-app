import { useState } from 'react';
import { Platform, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
  /**
   * Keeps `label` as the accessible name but doesn't draw it — for fields whose
   * placeholder acts as the label in the design ("Goal name", "Target amount").
   */
  hideLabel?: boolean;
  /**
   * Turns the field into a multi-line notes box `rows` lines tall (default look:
   * top-aligned text, grows with `rows`). Implies `multiline`.
   */
  rows?: number;
  /** Optional small hint drawn under the field (hidden while `errorMessage` shows). */
  helperText?: string;
}

const LINE_HEIGHT = 24;

/** Shared field chrome so SelectField / DateField line up pixel-for-pixel with TextField. */
export function useFieldChrome(isFocused: boolean, hasError: boolean) {
  const theme = useTheme();
  return {
    minHeight: 52,
    borderWidth: isFocused ? 2 : 1.5,
    borderColor: hasError ? theme.dangerSolid : isFocused ? theme.primary : theme.controlBorder,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    fontFamily: Fonts.body.regular,
    fontSize: 17,
    color: theme.text,
    backgroundColor: theme.backgroundElement,
  } as const;
}

/** Field label row shared by the form kit. Renders nothing visible when `hidden`. */
export function FieldLabel({ label, hidden }: { label: string; hidden?: boolean }) {
  if (hidden) return null;
  return <ThemedText type="smallBold">{label}</ThemedText>;
}

export function TextField({
  label,
  errorMessage,
  hideLabel,
  rows,
  helperText,
  style,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const chrome = useFieldChrome(isFocused, Boolean(errorMessage));
  const isNotes = rows !== undefined;

  return (
    <View style={{ gap: Spacing.two }}>
      <FieldLabel label={label} hidden={hideLabel} />
      <TextInput
        accessibilityLabel={errorMessage ? `${label}. ${errorMessage}` : label}
        placeholderTextColor={theme.textSecondary}
        multiline={isNotes || props.multiline}
        style={[
          chrome,
          {
            shadowColor: isFocused ? theme.primary : 'transparent',
            shadowOpacity: isFocused ? 0.14 : 0,
            shadowRadius: isFocused ? 4 : 0,
          },
          isNotes
            ? {
                minHeight: rows * LINE_HEIGHT + 24,
                paddingVertical: 12,
                lineHeight: LINE_HEIGHT,
                textAlignVertical: 'top',
                ...(Platform.OS === 'web' ? { resize: 'vertical' } : null),
              }
            : null,
          style,
        ]}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...props}
      />
      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : helperText ? (
        <ThemedText type="small" themeColor="textSecondary">
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}
