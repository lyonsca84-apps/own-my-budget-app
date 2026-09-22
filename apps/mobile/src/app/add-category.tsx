import { useState } from 'react';
import { View } from 'react-native';
import { createCategory } from '@own-my-budget/api';

import { closeDialogRoute, DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const CATEGORY_TYPES = [
  { value: 'bill', label: 'Bill' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'savings', label: 'Savings' },
  { value: 'debt', label: 'Debt' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'other', label: 'Other' },
];

/** Adds a budget category. It shows up right away in the Budget tab's Planned vs actual list. */
export default function AddCategoryScreen() {
  const { userId, isReady } = useDataUser();
  const [name, setName] = useState('');
  const [type, setType] = useState('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!isReady || !userId) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createCategory(supabase, {
        user_id: userId,
        name: name.trim(),
        type,
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
      title="Add category"
      subtitle="A place to plan and track spending, like Groceries or Rent."
      primaryLabel="Save category"
      onPrimary={handleSave}
      primaryDisabled={!name.trim()}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      <View style={{ gap: Space[4] }}>
        <TextField label="Name" placeholder="e.g. Groceries" value={name} onChangeText={setName} />
        <SelectField label="Type" value={type} onChange={setType} options={CATEGORY_TYPES} />
      </View>
    </DialogScreen>
  );
}
