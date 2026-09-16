import { View, type ViewProps } from 'react-native';

import { CardShadow, Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.backgroundElement,
          borderRadius: Radius.card,
          padding: Layout.cardPadding,
        },
        CardShadow,
        style,
      ]}
      {...props}
    />
  );
}
