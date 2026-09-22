import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getDebt, recordDebtPayment, updateDebt, type Tables } from '@own-my-budget/api';
import { formatCents, formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { formatDollarsInput, parseDollarsToCents } from '@/components/bills/common';
import { Button } from '@/components/ui/button';
import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { Fonts, Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface Slot {
  amount: string;
  date: string;
}

const newSlots = (): Slot[] =>
  [1, 2, 3].map(() => ({ amount: '', date: formatLocalDate(new Date()) }));

/**
 * "Manage payments" for a card or loan: record up to three payments (each one
 * goes through the transactional `record_debt_payment` function, so the
 * payment and the balance change always land together), adjust the amount due,
 * and — only if the balance is simply wrong — correct it.
 */
export default function RecordDebtPaymentScreen() {
  const { debtId } = useLocalSearchParams<{ debtId: string }>();
  const [debt, setDebt] = useState<Tables<'debts'> | null>(null);
  const [balance, setBalance] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [slots, setSlots] = useState<Slot[]>(newSlots());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!debtId) return;
    let mounted = true;
    getDebt(supabase, debtId)
      .then((row) => {
        if (!mounted) return;
        setDebt(row);
        setBalance(formatDollarsInput(row.balance_cents));
        setAmountDue(formatDollarsInput(row.minimum_payment_cents));
      })
      .catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "We couldn't load this account.")
      );
    return () => {
      mounted = false;
    };
  }, [debtId]);

  function updateSlot(index: number, changes: Partial<Slot>) {
    setSlots((list) => list.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  }

  async function handleSave() {
    if (!debtId || !debt) return;
    const filled = slots.filter((s) => s.amount.trim());
    const payments: { amountCents: number; paidOn: string }[] = [];
    for (const slot of filled) {
      const cents = parseDollarsToCents(slot.amount);
      if (!cents || cents <= 0) {
        setErrorMessage('Enter a valid amount for each payment.');
        return;
      }
      if (!isValidIsoDate(slot.date)) {
        setErrorMessage('Choose a date for each payment.');
        return;
      }
      payments.push({ amountCents: cents, paidOn: slot.date });
    }
    const balanceCents = parseDollarsToCents(balance);
    const dueCents = parseDollarsToCents(amountDue);
    if (balanceCents === null || dueCents === null) {
      setErrorMessage('Balance and amount due must be valid amounts.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      // A balance correction lands first so payments are applied on top of it.
      const changes: { balance_cents?: number; minimum_payment_cents?: number } = {};
      if (balanceCents !== debt.balance_cents) changes.balance_cents = balanceCents;
      if (dueCents !== debt.minimum_payment_cents) changes.minimum_payment_cents = dueCents;
      if (Object.keys(changes).length > 0) await updateDebt(supabase, debtId, changes);
      for (const payment of payments) {
        await recordDebtPayment(supabase, { debtId, ...payment });
      }
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCard = debt?.type === 'creditCard';

  return (
    <DialogScreen
      title={debt ? `Manage payments — ${debt.label}` : 'Manage payments'}
      subtitle={
        isCard
          ? 'Edit the balance, amount due, and log up to three payments.'
          : 'Edit the balance, amount due, and log up to three payments. Payments lower the balance.'
      }
      primaryLabel="Save changes"
      onPrimary={handleSave}
      primaryDisabled={!debt}
      busy={isSubmitting}
      errorMessage={errorMessage}
      size="lg"
    >
      <View style={{ gap: Space[3] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <TextField
              label="Current balance"
              value={balance}
              onChangeText={setBalance}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <TextField
              label="Amount due"
              value={amountDue}
              onChangeText={setAmountDue}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <ThemedText
          type="smallBold"
          themeColor="solidAccent"
          style={{ fontFamily: Fonts.body.semibold }}
        >
          Payments
        </ThemedText>
        {slots.map((slot, index) => (
          <View key={index} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
            <View style={{ flexGrow: 1, flexBasis: 200 }}>
              <TextField
                label={`Payment ${index + 1} amount`}
                hideLabel
                value={slot.amount}
                onChangeText={(amount) => updateSlot(index, { amount })}
                placeholder="Amount"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 200 }}>
              <DateField
                label={`Payment ${index + 1} date`}
                hideLabel
                value={slot.date}
                onChange={(date) => updateSlot(index, { date })}
              />
            </View>
          </View>
        ))}

        {debt ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              label={`Pay minimum (${formatCents(debt.minimum_payment_cents)})`}
              variant="soft"
              size="sm"
              shape="rounded"
              disabled={debt.minimum_payment_cents <= 0}
              onPress={() =>
                updateSlot(0, {
                  amount: formatDollarsInput(debt.minimum_payment_cents),
                  date: formatLocalDate(new Date()),
                })
              }
            />
          </View>
        ) : null}
      </View>
    </DialogScreen>
  );
}
