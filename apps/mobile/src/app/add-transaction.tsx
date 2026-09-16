import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createTransaction, listAccounts, listCategories, type Tables } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

export default function AddTransactionScreen() {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(formatLocalDate(new Date()));
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listCategories(supabase, user.id).then(setCategories);
    listAccounts(supabase, user.id).then((accounts) => setAccountId(accounts[0]?.id ?? null));
  }, [user]);

  async function handleSave() {
    if (!user) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    if (!label.trim()) {
      setErrorMessage('Enter a description.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createTransaction(supabase, {
        user_id: user.id,
        label: label.trim(),
        amount_cents: amountCents,
        occurred_on: occurredOn,
        category_id: categoryId,
        account_id: accountId,
        note: note.trim() || null,
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
        label="Description"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Coffee, gas, groceries"
      />
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
      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Add a note"
      />

      {categories.length > 0 && (
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="smallBold">Category</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Button
              label="None"
              variant={categoryId === null ? 'primary' : 'secondary'}
              onPress={() => setCategoryId(null)}
            />
            {categories.map((category) => (
              <Button
                key={category.id}
                label={category.name}
                variant={categoryId === category.id ? 'primary' : 'secondary'}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </View>
        </View>
      )}

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : 'Save transaction'}
        onPress={handleSave}
        disabled={isSubmitting || !label.trim() || !amount.trim()}
      />
    </Screen>
  );
}
