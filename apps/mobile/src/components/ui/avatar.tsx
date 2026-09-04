import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 36 }: AvatarProps) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      accessible
      accessibilityLabel={`${name} account menu`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.text,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText type="smallBold" themeColor="background">
        {initial}
      </ThemedText>
    </View>
  );
}
