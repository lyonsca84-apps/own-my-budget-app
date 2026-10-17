import { useId, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chevron } from '@/components/ui/chevron';
import type { SelectFieldProps } from '@/components/ui/select-field-types';
import { FieldLabel } from '@/components/ui/text-field';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type { SelectFieldProps, SelectOption } from '@/components/ui/select-field-types';

/**
 * Web: a real, styled `<select>` (so the OS picker, type-ahead and keyboard
 * behavior all work) with a drawn chevron — the "Choose a payday ⌄" field
 * from the design.
 */
export function SelectField({
  label,
  hideLabel,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  errorMessage,
  disabled,
  compact,
  width,
}: SelectFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [isFocused, setIsFocused] = useState(false);
  const errorId = useId();
  const hasValue = value !== null && value !== undefined && options.some((o) => o.value === value);

  return (
    <View style={{ gap: Spacing.two, width }}>
      <FieldLabel label={label} hidden={hideLabel} />
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <select
          aria-label={label}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errorId : undefined}
          disabled={disabled}
          value={hasValue ? (value as string) : ''}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            width: '100%',
            boxSizing: 'border-box',
            minHeight: compact ? 44 : 52,
            margin: 0,
            paddingLeft: Spacing.three,
            paddingRight: 40,
            borderStyle: 'solid',
            borderWidth: isFocused ? 2 : 1.5,
            borderColor: errorMessage
              ? theme.dangerSolid
              : isFocused
                ? theme.primary
                : theme.controlBorder,
            borderRadius: Radius.input,
            backgroundColor: theme.backgroundElement,
            color: hasValue ? theme.text : theme.textSecondary,
            fontFamily: Fonts.body.regular,
            fontSize: compact ? 15 : 17,
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            colorScheme: scheme,
            textOverflow: 'ellipsis',
          }}
        >
          <option value="" disabled hidden={hasValue}>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}
        >
          <Chevron color={theme.text} />
        </View>
      </View>
      {errorMessage ? (
        <ThemedText nativeID={errorId} type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}
