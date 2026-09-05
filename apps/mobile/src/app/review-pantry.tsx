import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addGroceryItems, getOrCreateDefaultGroceryList } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { scanHandoff } from '@/lib/scan-handoff';
import { Spacing } from '@/constants/theme';

interface CheckableItem {
  label: string;
  checked: boolean;
}

export default function ReviewPantryScreen() {
  const { user } = useAuth();
  // Captured once, on mount — scanHandoff is a one-shot handoff from
  // scan-pantry.tsx, not a live external source to keep resyncing with.
  const [pending] = useState(() => scanHandoff.pantry ?? null);
  const [wellStocked] = useState<string[]>(pending?.extraction.visible_items ?? []);
  const [candidates, setCandidates] = useState<CheckableItem[]>(
    pending?.extraction.running_low_or_missing.map((label) => ({ label, checked: true })) ?? []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) router.back();
  }, [pending]);

  function toggle(index: number) {
    setCandidates((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  async function handleAddToGroceryList() {
    if (!user) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const list = await getOrCreateDefaultGroceryList(supabase, user.id);
      const labels = candidates.filter((item) => item.checked).map((item) => item.label);
      await addGroceryItems(supabase, user.id, list.id, labels);
      scanHandoff.pantry = undefined;
      router.dismissTo('/grocery-list');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            What we saw
          </ThemedText>

          {wellStocked.length > 0 ? (
            <Card style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Looks well stocked</ThemedText>
              <ThemedText themeColor="textSecondary">{wellStocked.join(', ')}</ThemedText>
            </Card>
          ) : null}

          <ThemedText type="smallBold">Running low or missing — pick what to add</ThemedText>
          {candidates.length === 0 ? (
            <ThemedText themeColor="textSecondary">Nothing stood out as low or missing.</ThemedText>
          ) : (
            candidates.map((item, index) => (
              <Card
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <ThemedText>{item.label}</ThemedText>
                <Button
                  label={item.checked ? 'Added' : 'Add'}
                  variant={item.checked ? 'primary' : 'secondary'}
                  onPress={() => toggle(index)}
                />
              </Card>
            ))
          )}

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          <Button
            label={isSaving ? 'Adding…' : 'Add to grocery list'}
            onPress={handleAddToGroceryList}
            disabled={isSaving || candidates.every((item) => !item.checked)}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
