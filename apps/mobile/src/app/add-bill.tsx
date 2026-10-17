import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { createBill, type Database } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { parseDollarsToCents } from '@/components/bills/common';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Recurrence = Database['public']['Tables']['bills']['Row']['recurrence'];
const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'monthly', label: 'Every month' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'weekly', label: 'Every week' },
  { value: 'yearly', label: 'Every year' },
  { value: 'none', label: 'Does not repeat' },
];

/** Add a bill — a centered dialog over Bills & Debt. */
export default function AddBillScreen() {
  const { userId } = useDataUser();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(formatLocalDate(new Date()));
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [remind, setRemind] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!userId) return;
    const amountCents = parseDollarsToCents(amount);
    if (!label.trim()) {
      setErrorMessage('Give this bill a name.');
      return;
    }
    if (amountCents === null || amountCents <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    if (!isValidIsoDate(dueDate)) {
      setErrorMessage('Choose a due date.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createBill(supabase, {
        user_id: userId,
        label: label.trim(),
        amount_cents: amountCents,
        due_date: dueDate,
        recurrence,
        reminder_enabled: remind,
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
      title="Add bill"
      subtitle="Track what is due and what you have paid."
      primaryLabel="Add bill"
      onPrimary={handleSave}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      <View style={{ gap: Space[3] }}>
        <TextField
          label="Name"
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Electric"
          autoFocus
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <TextField
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <DateField label="Due date" value={dueDate} onChange={setDueDate} />
          </View>
        </View>
        <SelectField
          label="Repeats"
          value={recurrence}
          onChange={(value) => setRecurrence(value as Recurrence)}
          options={RECURRENCE_OPTIONS}
        />
        <CheckboxField label="Remind me before it is due" checked={remind} onChange={setRemind} />
      </View>
    </DialogScreen>
  );
}
