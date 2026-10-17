import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createTransaction, listAccounts, listCategories, type Tables } from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

type TransactionKind = 'expense' | 'income';

const NO_CATEGORY = '__none__';

const KIND_OPTIONS: { value: TransactionKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

/**
 * Record one transaction. Money out is stored as a negative amount and money
 * in as positive — the same convention the Budget and Dashboard use to count
 * spending, so an expense entered here shows up in Spending by Category.
 */
export default function AddTransactionScreen() {
  const { userId, isReady } = useDataUser();
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(formatLocalDate(new Date()));
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Tables<'accounts'>[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;
    Promise.all([listCategories(supabase, userId), listAccounts(supabase, userId)])
      .then(([loadedCategories, loadedAccounts]) => {
        if (!isMounted) return;
        setCategories(loadedCategories);
        setAccounts(loadedAccounts);
        setAccountId((current) => current ?? loadedAccounts[0]?.id ?? null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      });
    return () => {
      isMounted = false;
    };
  }, [isReady, userId]);

  async function handleSave() {
    if (!userId) return;
    const dollars = parseFloat(amount.replace(/[$,\s]/g, ''));
    const amountCents = Math.round(dollars * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErrorMessage('Enter an amount greater than zero.');
      return;
    }
    if (!label.trim()) {
      setErrorMessage('Enter a description.');
      return;
    }
    if (!isValidIsoDate(occurredOn)) {
      setErrorMessage('Enter a valid date.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createTransaction(supabase, {
        user_id: userId,
        label: label.trim(),
        amount_cents: kind === 'expense' ? -amountCents : amountCents,
        occurred_on: occurredOn,
        category_id: kind === 'expense' ? categoryId : null,
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
    <DialogScreen
      title="Add transaction"
      subtitle={kind === 'expense' ? 'Record something you spent.' : 'Record money that came in.'}
      primaryLabel="Save transaction"
      onPrimary={handleSave}
      primaryDisabled={!label.trim() || !amount.trim()}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      <SegmentedControl
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
        variant="soft"
        accessibilityLabel="Transaction type"
      />
      <TextField
        label="Description"
        value={label}
        onChangeText={setLabel}
        placeholder={kind === 'expense' ? 'e.g. Coffee, gas, groceries' : 'e.g. Refund, side job'}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ flexGrow: 1, flexBasis: 180 }}>
          <TextField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 180 }}>
          <DateField label="Date" value={occurredOn} onChange={setOccurredOn} />
        </View>
      </View>
      {kind === 'expense' && categories.length > 0 ? (
        <SelectField
          label="Category"
          value={categoryId ?? NO_CATEGORY}
          onChange={(next) => setCategoryId(next === NO_CATEGORY ? null : next)}
          options={[
            { value: NO_CATEGORY, label: 'No category' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
      ) : null}
      {accounts.length > 1 ? (
        <SelectField
          label="Account"
          value={accountId ?? ''}
          onChange={setAccountId}
          options={accounts.map((account) => ({ value: account.id, label: account.label }))}
        />
      ) : null}
      <TextField
        label="Notes (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Add a note"
        rows={3}
      />
    </DialogScreen>
  );
}
