import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteAccount } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

const CONFIRM_PHRASE = 'DELETE';

export default function DataPrivacyScreen() {
  const { signOut } = useAuth();
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
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: Spacing.five, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Data &amp; privacy
          </ThemedText>

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">What we store</ThemedText>
            <ThemedText themeColor="textSecondary">
              Your bills, debts, savings goals, categories, income, and payment history — everything
              you&rsquo;ve entered into the app. Receipt and pantry photos are used only to extract
              data at scan time and are not stored. Nothing is ever shared with or sold to third
              parties.
            </ThemedText>
          </Card>

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">Export your data</ThemedText>
            <ThemedText themeColor="textSecondary">
              Download everything as CSV or JSON, any time.
            </ThemedText>
            <Button
              label="Go to export"
              variant="secondary"
              onPress={() => router.push('/export-data')}
            />
          </Card>

          <Card style={{ gap: Spacing.two, borderColor: '#A8431B' }}>
            <ThemedText type="smallBold" themeColor="danger">
              Delete account
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              This permanently deletes your account and every bill, debt, goal, and payment
              you&rsquo;ve recorded. This cannot be undone. Type {CONFIRM_PHRASE} to confirm.
            </ThemedText>
            <TextField
              label={`Type ${CONFIRM_PHRASE} to confirm`}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
            />
            {errorMessage ? (
              <ThemedText type="small" themeColor="danger">
                {errorMessage}
              </ThemedText>
            ) : null}
            <Button
              label={isDeleting ? 'Deleting…' : 'Permanently delete my account'}
              onPress={handleDeleteAccount}
              disabled={isDeleting || confirmText !== CONFIRM_PHRASE}
            />
          </Card>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
