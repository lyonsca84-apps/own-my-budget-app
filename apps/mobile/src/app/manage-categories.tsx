import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { archiveCategory, listCategories, renameCategory, type Tables } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { closeDialogRoute, DialogScreen } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** Rename or archive budget categories. Archiving hides one from new planning; its history stays. */
export default function ManageCategoriesScreen() {
  const theme = useTheme();
  const { userId, isReady, guestDataVersion } = useDataUser();
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isReady || !userId) return;
    try {
      setCategories(await listCategories(supabase, userId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load categories.');
    } finally {
      setIsLoading(false);
    }
  }, [isReady, userId]);

  // guestDataVersion: reload after a guest-data reset.
  useFocusEffect(
    useCallback(() => {
      void guestDataVersion;
      reload();
    }, [reload, guestDataVersion])
  );

  async function run(action: () => Promise<void>) {
    setErrorMessage(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  function handleSaveRename() {
    if (!editingId || !editingName.trim()) return;
    const id = editingId;
    const name = editingName.trim();
    void run(async () => {
      await renameCategory(supabase, id, name);
      setEditingId(null);
    });
  }

  return (
    <DialogScreen
      title="Manage categories"
      subtitle="Rename a category or archive one you no longer plan for."
      errorMessage={errorMessage}
      secondaryLabel={null}
      footer={
        <>
          <Button
            label="+ Add category"
            variant="soft"
            shape="rounded"
            onPress={() => router.push('/add-category')}
            style={{ flex: 1 }}
          />
          <Button label="Done" shape="rounded" onPress={closeDialogRoute} style={{ flex: 1 }} />
        </>
      }
    >
      {isLoading ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : categories.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No categories yet. Add one to start organizing bills and budgets.
        </ThemedText>
      ) : (
        <View>
          {categories.map((category, index) =>
            editingId === category.id ? (
              <View
                key={category.id}
                style={{
                  gap: Space[3],
                  paddingVertical: Space[3],
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <TextField label="Name" value={editingName} onChangeText={setEditingName} />
                <View style={{ flexDirection: 'row', gap: Space[2] }}>
                  <Button
                    label="Save"
                    size="sm"
                    shape="rounded"
                    onPress={handleSaveRename}
                    disabled={!editingName.trim()}
                  />
                  <Button
                    label="Cancel"
                    variant="soft"
                    size="sm"
                    shape="rounded"
                    onPress={() => setEditingId(null)}
                  />
                </View>
              </View>
            ) : (
              <View
                key={category.id}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: Space[2],
                  paddingVertical: Space[3],
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
                  {category.name}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: Space[2] }}>
                  <Button
                    label="Rename"
                    variant="soft"
                    size="sm"
                    shape="rounded"
                    accessibilityLabel={`Rename ${category.name}`}
                    onPress={() => {
                      setEditingId(category.id);
                      setEditingName(category.name);
                    }}
                  />
                  <Button
                    label="Archive"
                    variant="dangerOutline"
                    size="sm"
                    shape="rounded"
                    accessibilityLabel={`Archive ${category.name}`}
                    onPress={() => void run(() => archiveCategory(supabase, category.id))}
                  />
                </View>
              </View>
            )
          )}
        </View>
      )}
    </DialogScreen>
  );
}
