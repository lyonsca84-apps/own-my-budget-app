import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createPaycheck, listIncomeSources, type Tables } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { centsToInputText, parseDollarsToCents } from '@/components/budget/amount-input';
import { DateField } from '@/components/ui/date-field';
import { isValidIsoDate } from '@/components/ui/date-field-types';
import { closeDialogRoute, DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const NO_SOURCE = '__none__';

/** "Log a paycheck": records money that has landed, optionally against a pay schedule. */
export default function AddPaycheckScreen() {
  const { userId, isReady } = useDataUser();
  const [incomeSources, setIncomeSources] = useState<Tables<'income_sources'>[]>([]);
  const [sourceId, setSourceId] = useState(NO_SOURCE);
  const [amount, setAmount] = useState('');
  const [payDate, setPayDate] = useState(formatLocalDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;
    listIncomeSources(supabase, userId)
      .then((sources) => {
        if (!isMounted) return;
        setIncomeSources(sources);
        if (sources[0]) {
          setSourceId(sources[0].id);
          setAmount(centsToInputText(sources[0].amount_cents));
        }
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      });
    return () => {
      isMounted = false;
    };
  }, [isReady, userId]);

  function chooseSource(value: string) {
    setSourceId(value);
    const source = incomeSources.find((s) => s.id === value);
    if (source) setAmount(centsToInputText(source.amount_cents));
  }

  async function handleSave() {
    if (!isReady || !userId) return;
    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setErrorMessage('Enter the amount that landed.');
      return;
    }
    if (!isValidIsoDate(payDate)) {
      setErrorMessage('Pick the date you were paid.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createPaycheck(supabase, {
        user_id: userId,
        income_source_id: sourceId === NO_SOURCE ? null : sourceId,
        amount_cents: amountCents,
        pay_date: payDate,
      });
      closeDialogRoute();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogScreen
      title="Log a paycheck"
      subtitle="Record money that has landed. You can split it across categories afterward."
      primaryLabel="Save paycheck"
      onPrimary={handleSave}
      primaryDisabled={!amount.trim()}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      <View style={{ gap: Space[4] }}>
        <SelectField
          label="Income source"
          value={sourceId}
          onChange={chooseSource}
          options={[
            ...incomeSources.map((s) => ({ value: s.id, label: s.label })),
            { value: NO_SOURCE, label: 'Other / one-time' },
          ]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <TextField
              label="Amount"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <DateField label="Pay date" value={payDate} onChange={setPayDate} />
          </View>
        </View>
      </View>
    </DialogScreen>
  );
}
