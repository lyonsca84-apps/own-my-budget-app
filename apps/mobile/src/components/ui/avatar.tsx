import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface AvatarProps {
  name: string;
  size?: number;
  /** The user's own uploaded photo; falls back to their initial. */
  imageUri?: string | null;
}

export function Avatar({ name, size = 36, imageUri }: AvatarProps) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        accessibilityLabel={`${name} profile photo`}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

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
