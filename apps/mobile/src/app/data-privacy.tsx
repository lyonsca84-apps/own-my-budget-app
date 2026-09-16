import { router } from 'expo-router';
import { useState } from 'react';
import { deleteAccount } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const CONFIRM_PHRASE = 'DELETE';

export default function DataPrivacyScreen() {
  const { signOut } = useAuth();
  const theme = useTheme();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDeleteAccount() {
    if (confirmText !== CONFIRM_PHRASE) return;
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      await deleteAccount(supabase);
      await signOut();
      router.replace('/');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong. Nothing was changed.'
      );
      setIsDeleting(false);
    }
  }

  return (
    <Screen>
      <SectionCard title="What we store">
        <ThemedText themeColor="textSecondary">
          Your bills, debts, savings goals, categories, income, and payment history — everything
          you&rsquo;ve entered into the app. Receipt and pantry photos are used only to extract data
          at scan time and are not stored. Nothing is ever shared with or sold to third parties.
        </ThemedText>
      </SectionCard>

      <SectionCard title="Export your data">
        <ThemedText themeColor="textSecondary">
          Download everything as CSV or JSON, any time.
        </ThemedText>
        <Button
          label="Go to export"
          variant="secondary"
          onPress={() => router.push('/export-data')}
        />
      </SectionCard>

      <SectionCard
        title="Delete account"
        style={{ borderWidth: 1.5, borderColor: theme.dangerSolid }}
      >
        <ThemedText themeColor="textSecondary">
          This permanently deletes your account and every bill, debt, goal, and payment you&rsquo;ve
          recorded. This cannot be undone. Type {CONFIRM_PHRASE} to confirm.
        </ThemedText>
        <TextField
          label={`Type ${CONFIRM_PHRASE} to confirm`}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
        />
        {errorMessage ? <ThemedText themeColor="danger">{errorMessage}</ThemedText> : null}
        <Button
          label={isDeleting ? 'Deleting…' : 'Permanently delete my account'}
          onPress={handleDeleteAccount}
          disabled={isDeleting || confirmText !== CONFIRM_PHRASE}
        />
      </SectionCard>
    </Screen>
  );
}
