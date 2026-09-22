import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Space } from '@/constants/theme';

export interface BudgetCardProps {
  title: string;
  /** Right-aligned action(s) on the title row; wraps under the title when narrow. */
  action?: ReactNode;
  children: ReactNode;
}

/** The Budget page's white section card: a 20px title (with optional actions) over its content. */
export function BudgetCard({ title, action, children }: BudgetCardProps) {
  return (
    <Card style={{ gap: Space[4] }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          columnGap: Space[3],
          rowGap: Space[2],
        }}
      >
        <ThemedText
          accessibilityRole="header"
          style={{
            fontFamily: Fonts.heading.semibold,
            fontSize: 20,
            lineHeight: 26,
            letterSpacing: -0.2,
            flexShrink: 1,
          }}
        >
          {title}
        </ThemedText>
        {action}
      </View>
      {children}
    </Card>
  );
}
