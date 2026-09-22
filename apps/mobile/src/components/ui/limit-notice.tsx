import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface LimitNoticeProps {
  /** The gate's own upgrade-friendly reason text, shown as-is. */
  reason: string;
  /** Defaults to "Plan limit reached". */
  title?: string;
}

/**
 * A plan limit isn't a failure — it's a calm "you've used this up" note with
 * a way forward. Amber accent (never red), no mascot, and the button just
 * opens the existing plans screen.
 */
export function LimitNotice({ reason, title = 'Plan limit reached' }: LimitNoticeProps) {
  const theme = useTheme();

  return (
    <Card
      style={{
        gap: Space[3],
        borderLeftWidth: 4,
        borderLeftColor: theme.warningSolid,
      }}
    >
      <ThemedText type="smallBold" themeColor="warning">
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {reason}
      </ThemedText>
      <View style={{ flexDirection: 'row' }}>
        <Button label="See plans" variant="secondary" onPress={() => router.push('/paywall')} />
      </View>
    </Card>
  );
}
