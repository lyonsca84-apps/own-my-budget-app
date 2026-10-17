import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetBuddyChat } from '@/components/helper/budget-buddy-chat';
import { useBudgetBuddyChat } from '@/components/helper/use-budget-buddy-chat';
import { ThemedView } from '@/components/themed-view';

/**
 * Full-screen Budget Buddy chat — what the floating button opens on phones
 * and narrow windows (wide layouts get the floating panel instead). An
 * optional `prompt` param pre-fills the composer, e.g. from a pantry scan.
 */
export default function HelperScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const chat = useBudgetBuddyChat(typeof prompt === 'string' ? prompt : '');
  const { reloadGate } = chat;

  useEffect(() => {
    reloadGate();
  }, [reloadGate]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Budget Buddy' }} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <BudgetBuddyChat chat={chat} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
