import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recordGoalActivity } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AddGoalActivityScreen() {
  const { goalId, kind } = useLocalSearchParams<{
    goalId: string;
    kind: 'deposit' | 'withdrawal';
  }>();
  const isWithdrawal = kind === 'withdrawal';
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(formatLocalDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!goalId) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await recordGoalActivity(supabase, {
        goalId,
        amountCents,
        kind: isWithdrawal ? 'withdrawal' : 'deposit',
        occurredOn,
      });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: Spacing.five, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            {isWithdrawal ? 'Withdraw from goal' : 'Add a deposit'}
          </ThemedText>

          <TextField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <TextField
            label="Date"
            value={occurredOn}
            onChangeText={setOccurredOn}
            placeholder="YYYY-MM-DD"
          />

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          <Button
            label={isSubmitting ? 'Saving…' : isWithdrawal ? 'Save withdrawal' : 'Save deposit'}
            onPress={handleSave}
            disabled={isSubmitting || !amount.trim()}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
