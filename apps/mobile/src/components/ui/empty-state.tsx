import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Space } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';

export interface EmptyStateProps {
  title: string;
  message: string;
  /** Shows the mascot — encouragement only, per the handoff's mascot-usage rule. Never set this for an error state. */
  mascot?: boolean;
  action?: ReactNode;
}

/**
 * A clearly-labeled "not built yet" placeholder — used for tabs whose real
 * content depends on work scoped to a later phase, so screens are honest
 * about what's real vs. not, per PLAN.md's phased build plan.
 */
export function EmptyState({ title, message, mascot, action }: EmptyStateProps) {
  return (
    <Card style={{ alignItems: 'center', gap: Space[3] }}>
      {mascot ? (
        <Image
          source={BrandAssets.mascotTransparent}
          style={{ width: 96, height: 96 }}
          contentFit="contain"
          accessibilityLabel=""
        />
      ) : null}
      <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      <View style={{ maxWidth: 360 }}>
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {message}
        </ThemedText>
      </View>
      {action ? <View style={{ width: '100%', maxWidth: 320 }}>{action}</View> : null}
    </Card>
  );
}
