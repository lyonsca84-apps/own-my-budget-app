import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/theme';

export interface PlaceholderScreenProps {
  title: string;
  message: string;
}

/** Shared layout for the 4 tabs whose real content is scoped to a later phase. */
export function PlaceholderScreen({ title, message }: PlaceholderScreenProps) {
  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four }}>
          <EmptyState title={title} message={message} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
