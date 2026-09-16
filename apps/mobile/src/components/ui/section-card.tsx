import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Space } from '@/constants/theme';

export interface SectionCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A Card with the "label + trailing action" header row every list section in the app repeats. */
export function SectionCard({ title, action, children, style }: SectionCardProps) {
  return (
    <Card style={[{ gap: Space[4] }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {action}
      </View>
      {children}
    </Card>
  );
}
