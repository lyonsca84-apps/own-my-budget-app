import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
}

export function TextField({ label, errorMessage, style, ...props }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          {
            minHeight: 44,
            borderWidth: 1,
            borderColor: errorMessage ? theme.danger : theme.border,
            borderRadius: Spacing.three,
            paddingHorizontal: Spacing.three,
            paddingVertical: Spacing.two,
            fontSize: 16,
            color: theme.text,
            backgroundColor: theme.backgroundElement,
          },
          style,
        ]}
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
