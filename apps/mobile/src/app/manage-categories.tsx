import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { archiveCategory, listCategories, renameCategory, type Tables } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

export default function ManageCategoriesScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setCategories(await listCategories(supabase, user.id));
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function startEditing(category: Tables<'categories'>) {
    setEditingId(category.id);
    setEditingName(category.name);
  }

  async function handleSaveRename() {
    if (!editingId || !editingName.trim()) return;
    await renameCategory(supabase, editingId, editingName.trim());
    setEditingId(null);
    await reload();
  }

  async function handleArchive(categoryId: string) {
    await archiveCategory(supabase, categoryId);
    await reload();
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Manage categories
          </ThemedText>

          <Button label="Add category" onPress={() => router.push('/add-category')} />

          {isLoading ? (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          ) : categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              message="Add one to start organizing bills and budgets."
            />
          ) : (
            categories.map((category) =>
              editingId === category.id ? (
                <Card key={category.id} style={{ gap: Spacing.two }}>
                  <TextField label="Name" value={editingName} onChangeText={setEditingName} />
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Button
                      label="Save"
                      onPress={handleSaveRename}
                      disabled={!editingName.trim()}
                    />
                    <Button label="Cancel" variant="secondary" onPress={() => setEditingId(null)} />
                  </View>
                </Card>
              ) : (
                <Card
                  key={category.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <ThemedText>{category.name}</ThemedText>
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Button
                      label="Rename"
                      variant="secondary"
                      onPress={() => startEditing(category)}
                    />
                    <Button
                      label="Archive"
                      variant="secondary"
                      onPress={() => handleArchive(category.id)}
                    />
                  </View>
                </Card>
              )
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
