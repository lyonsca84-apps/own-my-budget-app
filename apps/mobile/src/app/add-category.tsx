import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { createCategory, type Database } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

type CategoryType = Database['public']['Tables']['categories']['Row']['type'];
const CATEGORY_TYPES: CategoryType[] = [
  'bill',
  'groceries',
  'savings',
  'debt',
  'allowance',
  'other',
];

export default function AddCategoryScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!user) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createCategory(supabase, { user_id: user.id, name: name.trim(), type });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Groceries" />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold">Type</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {CATEGORY_TYPES.map((option) => (
            <Button
              key={option}
              label={option}
              variant={option === type ? 'primary' : 'secondary'}
              onPress={() => setType(option)}
            />
          ))}
        </View>
      </View>

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : 'Save category'}
        onPress={handleSave}
        disabled={isSubmitting || !name.trim()}
      />
    </Screen>
  );
}
