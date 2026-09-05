import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addGroceryItems,
  getOrCreateDefaultGroceryList,
  listGroceryItems,
  toggleGroceryItem,
  type Tables,
} from '@own-my-budget/api';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

export default function GroceryListScreen() {
  const { status, user } = useAuth();
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<Tables<'grocery_items'>[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    const list = await getOrCreateDefaultGroceryList(supabase, user.id);
    setListId(list.id);
    setItems(await listGroceryItems(supabase, list.id));
    setIsLoading(false);
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handleToggle(itemId: string, isChecked: boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, is_checked: isChecked } : item))
    );
    await toggleGroceryItem(supabase, itemId, isChecked);
  }

  async function handleAddItem() {
    if (!user || !listId || !newItemLabel.trim()) return;
    const label = newItemLabel.trim();
    setNewItemLabel('');
    const [created] = await addGroceryItems(supabase, user.id, listId, [label]);
    if (created) setItems((prev) => [...prev, created]);
  }

  const estimatedTotalCents = items
    .filter((item) => !item.is_checked)
    .reduce((sum, item) => sum + (item.estimated_price_cents ?? 0), 0);

  if (status === 'guest') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: Spacing.five }}>
            <EmptyState
              title="Track your grocery list"
              message="Create a free account to keep a grocery list and pull items in from pantry scans."
            />
            <View style={{ marginTop: Spacing.three }}>
              <Button label="Create an account" onPress={() => router.push('/sign-up')} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Grocery list
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Estimated remaining: {formatCents(estimatedTotalCents)}
          </ThemedText>

          {isLoading ? (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          ) : items.length === 0 ? (
            <EmptyState
              title="Your list is empty"
              message="Add an item below, or scan your pantry for suggestions."
            />
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <ThemedText
                  style={{ textDecorationLine: item.is_checked ? 'line-through' : 'none', flex: 1 }}
                  themeColor={item.is_checked ? 'textSecondary' : 'text'}
                >
                  {item.label}
                </ThemedText>
                <Button
                  label={item.is_checked ? 'Checked' : 'Check'}
                  variant={item.is_checked ? 'secondary' : 'primary'}
                  onPress={() => handleToggle(item.id, !item.is_checked)}
                />
              </Card>
            ))
          )}

          <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Add an item"
                value={newItemLabel}
                onChangeText={setNewItemLabel}
                placeholder="e.g. Milk"
                onSubmitEditing={handleAddItem}
              />
            </View>
            <Button label="Add" onPress={handleAddItem} disabled={!newItemLabel.trim()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
