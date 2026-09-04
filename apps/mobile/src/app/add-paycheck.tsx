import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPaycheck, listIncomeSources, type Tables } from '@own-my-budget/api';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

export default function AddPaycheckScreen() {
  const { user } = useAuth();
  const [incomeSources, setIncomeSources] = useState<Tables<'income_sources'>[]>([]);
  const [selectedIncomeSourceId, setSelectedIncomeSourceId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listIncomeSources(supabase, user.id).then((sources) => {
      setIncomeSources(sources);
      if (sources[0]) {
        setSelectedIncomeSourceId(sources[0].id);
        setAmount((sources[0].amount_cents / 100).toFixed(2));
      }
    });
  }, [user]);

  async function handleSave() {
    if (!user) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    if (!payDate.trim()) {
      setErrorMessage('Enter a pay date.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createPaycheck(supabase, {
        user_id: user.id,
        income_source_id: selectedIncomeSourceId,
        amount_cents: amountCents,
        pay_date: payDate.trim(),
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
            Log a paycheck
          </ThemedText>

          {incomeSources.length > 0 && (
            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Income source</ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {incomeSources.map((source) => (
                  <Button
                    key={source.id}
                    label={source.label}
                    variant={source.id === selectedIncomeSourceId ? 'primary' : 'secondary'}
                    onPress={() => {
                      setSelectedIncomeSourceId(source.id);
                      setAmount((source.amount_cents / 100).toFixed(2));
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          <TextField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <TextField
            label="Pay date"
            value={payDate}
            onChangeText={setPayDate}
            placeholder="YYYY-MM-DD"
          />

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          <Button
            label={isSubmitting ? 'Saving…' : 'Save paycheck'}
            onPress={handleSave}
            disabled={isSubmitting || !amount.trim() || !payDate.trim()}
          />

          {incomeSources.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Amount shown: {formatCents(Math.round((parseFloat(amount) || 0) * 100))}
            </ThemedText>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
