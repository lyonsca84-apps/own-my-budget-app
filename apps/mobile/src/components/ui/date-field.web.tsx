import { useId, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { DateFieldProps } from '@/components/ui/date-field-types';
import { FieldLabel } from '@/components/ui/text-field';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export { isValidIsoDate, type DateFieldProps } from '@/components/ui/date-field-types';

/** Web: a real `<input type="date">` (browser calendar popup, keyboard entry) styled to match TextField. */
export function DateField({
  label,
  hideLabel,
  value,
  onChange,
  errorMessage,
  disabled,
  min,
  max,
}: DateFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [isFocused, setIsFocused] = useState(false);
  const errorId = useId();

  return (
    <View style={{ gap: Spacing.two }}>
      <FieldLabel label={label} hidden={hideLabel} />
      <input
        type="date"
        aria-label={label}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 52,
          margin: 0,
          paddingLeft: Spacing.three,
          paddingRight: Spacing.three,
          borderStyle: 'solid',
          borderWidth: isFocused ? 2 : 1.5,
          borderColor: errorMessage
            ? theme.dangerSolid
            : isFocused
              ? theme.primary
              : theme.controlBorder,
          borderRadius: Radius.input,
          backgroundColor: theme.backgroundElement,
          color: value ? theme.text : theme.textSecondary,
          fontFamily: Fonts.body.regular,
          fontSize: 17,
          outline: 'none',
          colorScheme: scheme,
          opacity: disabled ? 0.55 : 1,
        }}
      />
      {errorMessage ? (
        <ThemedText nativeID={errorId} type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}
