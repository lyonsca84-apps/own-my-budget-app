import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
}

export function TextField({
  label,
  errorMessage,
  style,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={errorMessage ? `${label}. ${errorMessage}` : label}
        placeholderTextColor={theme.textSecondary}
        style={[
          {
            minHeight: 52,
            borderWidth: isFocused ? 2 : 1.5,
            borderColor: errorMessage
              ? theme.dangerSolid
              : isFocused
                ? theme.primary
                : theme.controlBorder,
            borderRadius: Radius.input,
            paddingHorizontal: Spacing.three,
            fontFamily: Fonts.body.regular,
            fontSize: 17,
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            shadowColor: isFocused ? theme.primary : 'transparent',
            shadowOpacity: isFocused ? 0.14 : 0,
            shadowRadius: isFocused ? 4 : 0,
          },
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
      ) : null}
    </View>
  );
}
