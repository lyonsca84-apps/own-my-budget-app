import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';

export interface SubsectionHeaderProps {
  title: string;
  action?: ReactNode;
}

/** An H2-weight heading with a trailing action — for a group of standalone cards under a page-level ScreenHeader. */
export function SubsectionHeader({ title, action }: SubsectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Space[3],
      }}
    >
      <ThemedText type="subtitle">{title}</ThemedText>
      {action}
    </View>
  );
}
