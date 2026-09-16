import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** A trailing control — an "+ Add" Button, an Avatar, a filter chip row. */
  action?: ReactNode;
}

/** The page heading every screen family uses: H1 title, optional subtitle, optional trailing action. */
export function ScreenHeader({ title, subtitle, eyebrow, action }: ScreenHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: subtitle || eyebrow ? 'flex-start' : 'center',
        gap: Space[3],
      }}
    >
      <View style={{ flexShrink: 1, gap: Space[1] }}>
        {eyebrow ? (
          <ThemedText type="eyebrow" themeColor="primary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="title">{title}</ThemedText>
        {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {action}
    </View>
  );
}
