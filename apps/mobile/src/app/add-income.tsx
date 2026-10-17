import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createIncomeSource, getIncomeSource, updateIncomeSource } from '@own-my-budget/api';
import { joinIncomeLabel, splitIncomeLabel } from '@own-my-budget/core';

import { centsToInputText, parseDollarsToCents } from '@/components/budget/amount-input';
import { FREQUENCY_LABEL } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { isValidIsoDate } from '@/components/ui/date-field-types';
import { DateField } from '@/components/ui/date-field';
import { closeDialogRoute, DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const FREQUENCY_OPTIONS = ['weekly', 'biweekly', 'twice_monthly', 'monthly', 'variable'].map(
  (value) => ({ value, label: FREQUENCY_LABEL[value] ?? value })
);

const DATE_LABEL: Record<string, string> = {
  weekly: 'Next pay date',
  biweekly: 'Next pay date',
  twice_monthly: 'A pay date (the other is 15 days apart)',
  monthly: 'Next pay date (repeats on this day each month)',
  variable: 'Expected pay date',
};

/**
 * "Add income source" / "Edit pay schedule" dialog. Opened with an `id` param
 * from the Budget tab's Pay schedules list to edit one. Schedules are never
 * deleted — clearing "Active" pauses one (it stops projecting paydays).
 */
export default function AddIncomeScreen() {
  const { userId, isReady } = useDataUser();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const [person, setPerson] = useState('');
  const [source, setSource] = useState('');
  const [frequency, setFrequency] = useState('biweekly');
  const [amount, setAmount] = useState('');
  const [nextPayDate, setNextPayDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    getIncomeSource(supabase, id)
      .then((row) => {
        if (!isMounted) return;
        const parts = splitIncomeLabel(row.label);
        setPerson(parts.person);
        setSource(parts.source);
        setAmount(centsToInputText(row.amount_cents));
        setFrequency(row.frequency);
        setNextPayDate(row.next_pay_date ?? '');
        setIsActive(row.archived_at === null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleSave() {
    if (!isReady || !userId) return;
    const label = joinIncomeLabel(person, source);
    if (!label) {
      setErrorMessage('Enter a name or an employer for this income.');
      return;
    }
    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setErrorMessage('Enter the take-home amount per paycheck.');
      return;
    }
    if (!isValidIsoDate(nextPayDate)) {
      setErrorMessage('Pick the date of the next paycheck so your paydays can be planned.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (id) {
        await updateIncomeSource(supabase, id, {
          label,
          amount_cents: amountCents,
          frequency,
          next_pay_date: nextPayDate,
          archived_at: isActive ? null : new Date().toISOString(),
        });
      } else {
        await createIncomeSource(supabase, {
          user_id: userId,
          label,
          amount_cents: amountCents,
          frequency,
          next_pay_date: nextPayDate,
          archived_at: isActive ? null : new Date().toISOString(),
        });
      }
      closeDialogRoute();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogScreen
      title={isEditing ? 'Edit pay schedule' : 'Add income source'}
      subtitle="Where your money comes from and how often you get paid."
      primaryLabel={isEditing ? 'Save changes' : 'Add income source'}
      onPrimary={handleSave}
      primaryDisabled={isLoading || !amount.trim()}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      {isLoading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : (
        <View style={{ gap: Space[4] }}>
          <TextField
            label="Name"
            hideLabel
            placeholder="Name (whose paycheck?)"
            value={person}
            onChangeText={setPerson}
          />
          <TextField
            label="Employer / income source"
            hideLabel
            placeholder="Employer / income source"
            value={source}
            onChangeText={setSource}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
            <View style={{ flexGrow: 1, flexBasis: 200 }}>
              <SelectField
                label="Frequency"
                value={frequency}
                onChange={setFrequency}
                options={FREQUENCY_OPTIONS}
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 200 }}>
              <TextField
                label="Take-home amount"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>
          <DateField
            label={DATE_LABEL[frequency] ?? 'Next pay date'}
            value={nextPayDate}
            onChange={setNextPayDate}
          />
          <CheckboxField label="Active" checked={isActive} onChange={setIsActive} />
          {!isActive ? (
            <ThemedText type="small" themeColor="textSecondary">
              Paused schedules do not project paydays. Nothing is deleted — turn Active back on to
              plan around it again.
            </ThemedText>
          ) : null}
        </View>
      )}
    </DialogScreen>
  );
}
