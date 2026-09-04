import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

export interface EmptyStateProps {
  title: string;
  message: string;
}

/**
 * A clearly-labeled "not built yet" placeholder — used for tabs whose real
 * content depends on work scoped to a later phase, so screens are honest
 * about what's real vs. not, per PLAN.md's phased build plan.
 */
export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <Card style={{ alignItems: 'center', gap: Spacing.two }}>
      <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      <View style={{ maxWidth: 360 }}>
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {message}
        </ThemedText>
      </View>
    </Card>
  );
}
