import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { archiveCategory, listCategories, renameCategory, type Tables } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

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
    <Screen>
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
            <Card key={category.id} style={{ gap: Space[2] }}>
              <TextField label="Name" value={editingName} onChangeText={setEditingName} />
              <View style={{ flexDirection: 'row', gap: Space[2] }}>
                <Button label="Save" onPress={handleSaveRename} disabled={!editingName.trim()} />
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
              <View style={{ flexDirection: 'row', gap: Space[2] }}>
                <Button label="Rename" variant="secondary" onPress={() => startEditing(category)} />
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
    </Screen>
  );
}
