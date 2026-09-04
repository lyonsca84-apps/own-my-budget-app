import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createDebt, type Database } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

type DebtType = Database['public']['Tables']['debts']['Row']['type'];
const DEBT_TYPES: DebtType[] = [
  'creditCard',
  'autoLoan',
  'mortgage',
  'personalLoan',
  'studentLoan',
  'other',
];

export default function AddDebtScreen() {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<DebtType>('creditCard');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!user) return;
    const balanceCents = Math.round(parseFloat(balance) * 100);
    if (!Number.isFinite(balanceCents) || balanceCents < 0) {
      setErrorMessage('Enter a valid balance.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createDebt(supabase, {
        user_id: user.id,
        label: label.trim(),
        type,
        balance_cents: balanceCents,
        apr_basis_points: Math.round((parseFloat(apr) || 0) * 100),
        minimum_payment_cents: Math.round((parseFloat(minimumPayment) || 0) * 100),
        credit_limit_cents: creditLimit.trim() ? Math.round(parseFloat(creditLimit) * 100) : null,
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
            Add debt
          </ThemedText>

          <TextField label="Name" value={label} onChangeText={setLabel} placeholder="e.g. Visa" />

          <View style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold">Type</ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              {DEBT_TYPES.map((option) => (
                <Button
                  key={option}
                  label={option}
                  variant={option === type ? 'primary' : 'secondary'}
                  onPress={() => setType(option)}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Current balance"
            value={balance}
            onChangeText={setBalance}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <TextField
            label="APR (%)"
            value={apr}
            onChangeText={setApr}
            placeholder="e.g. 23.99"
            keyboardType="decimal-pad"
          />
          <TextField
            label="Minimum payment"
            value={minimumPayment}
            onChangeText={setMinimumPayment}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          {type === 'creditCard' && (
            <TextField
              label="Credit limit (optional)"
              value={creditLimit}
              onChangeText={setCreditLimit}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          )}

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          <Button
            label={isSubmitting ? 'Saving…' : 'Save debt'}
            onPress={handleSave}
            disabled={isSubmitting || !label.trim() || !balance.trim()}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
