import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { getBill, recordBillPayment } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';
import { View } from 'react-native';

import { formatDollarsInput, parseDollarsToCents } from '@/components/bills/common';
import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

/** "Log payment — Rent": records what was actually paid (partial payments are fine). */
export default function RecordBillPaymentScreen() {
  const { userId } = useDataUser();
  const { billId, amountCents: prefillCents } = useLocalSearchParams<{
    billId: string;
    amountCents?: string;
  }>();
  // Bills & Debt passes what's still owed so "Log payment" is one tap for a full payment.
  const prefill = Number(prefillCents);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(
    Number.isFinite(prefill) && prefill > 0 ? formatDollarsInput(prefill) : ''
  );
  const [paidOn, setPaidOn] = useState(formatLocalDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!billId) return;
    let mounted = true;
    getBill(supabase, billId)
      .then((bill) => mounted && setName(bill.label))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [billId]);

  async function handleSave() {
    if (!userId || !billId) return;
    const cents = parseDollarsToCents(amount);
    if (cents === null || cents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    if (!isValidIsoDate(paidOn)) {
      setErrorMessage('Choose the date you paid.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await recordBillPayment(supabase, {
        user_id: userId,
        bill_id: billId,
        amount_cents: cents,
        paid_on: paidOn,
      });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogScreen
      title={name ? `Log payment — ${name}` : 'Log payment'}
      subtitle="Enter an amount to apply. Partial payments are fine."
      primaryLabel="Save"
      onPrimary={handleSave}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      <View style={{ gap: Space[3] }}>
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoFocus
        />
        <DateField label="Date paid" value={paidOn} onChange={setPaidOn} />
      </View>
    </DialogScreen>
  );
}
