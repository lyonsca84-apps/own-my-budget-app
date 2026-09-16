import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { createIncomeSource, type Database } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

type Frequency = Database['public']['Tables']['income_sources']['Row']['frequency'];
const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'twice_monthly', 'monthly', 'variable'];

export default function AddIncomeScreen() {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('biweekly');
  const [nextPayDate, setNextPayDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!user) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createIncomeSource(supabase, {
        user_id: user.id,
        label: label.trim(),
        amount_cents: amountCents,
        frequency,
        next_pay_date: nextPayDate.trim() || null,
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
      <TextField
        label="Source"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Riverside Retail"
      />
      <TextField
        label="Amount per paycheck"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold">Frequency</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {FREQUENCIES.map((option) => (
            <Button
              key={option}
              label={option.replace('_', ' ')}
              variant={option === frequency ? 'primary' : 'secondary'}
              onPress={() => setFrequency(option)}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Next pay date (optional)"
        value={nextPayDate}
        onChangeText={setNextPayDate}
        placeholder="YYYY-MM-DD"
      />

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : 'Save income source'}
        onPress={handleSave}
        disabled={isSubmitting || !label.trim() || !amount.trim()}
      />
    </Screen>
  );
}
