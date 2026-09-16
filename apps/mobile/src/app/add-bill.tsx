import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { createBill, type Database } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

type Recurrence = Database['public']['Tables']['bills']['Row']['recurrence'];
const RECURRENCES: Recurrence[] = ['none', 'weekly', 'biweekly', 'monthly', 'yearly'];

export default function AddBillScreen() {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!user) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    if (!dueDate.trim()) {
      setErrorMessage('Enter a due date.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createBill(supabase, {
        user_id: user.id,
        label: label.trim(),
        amount_cents: amountCents,
        due_date: dueDate.trim(),
        recurrence,
      });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <TextField label="Name" value={label} onChangeText={setLabel} placeholder="e.g. Electric" />
      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      <TextField
        label="Due date"
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
      />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold">Repeats</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {RECURRENCES.map((option) => (
            <Button
              key={option}
              label={option}
              variant={option === recurrence ? 'primary' : 'secondary'}
              onPress={() => setRecurrence(option)}
            />
          ))}
        </View>
      </View>

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : 'Save bill'}
        onPress={handleSave}
        disabled={isSubmitting || !label.trim() || !amount.trim() || !dueDate.trim()}
      />
    </Screen>
  );
}
