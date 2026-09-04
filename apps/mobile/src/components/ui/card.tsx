import { View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.backgroundElement,
          borderRadius: Spacing.four,
          borderWidth: 1,
          borderColor: theme.border,
          padding: Spacing.four,
        },
        style,
      ]}
      {...props}
    />
  );
}
