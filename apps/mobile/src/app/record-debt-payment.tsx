import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { recordDebtPayment } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { supabase } from '@/lib/supabase';

export default function RecordDebtPaymentScreen() {
  const { debtId } = useLocalSearchParams<{ debtId: string }>();
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(formatLocalDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!debtId) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await recordDebtPayment(supabase, { debtId, amountCents, paidOn });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      <TextField
        label="Date paid"
        value={paidOn}
        onChangeText={setPaidOn}
        placeholder="YYYY-MM-DD"
      />

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : 'Save payment'}
        onPress={handleSave}
        disabled={isSubmitting || !amount.trim()}
      />
    </Screen>
  );
}
