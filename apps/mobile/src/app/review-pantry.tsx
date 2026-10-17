import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  addGroceryItems,
  getOrCreateDefaultGroceryList,
  listGroceryItems,
} from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { Layout, Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { scanHandoff } from '@/lib/scan-handoff';

interface CheckableItem {
  label: string;
  checked: boolean;
  /** Already on the grocery list — shown, but not added twice. */
  onList: boolean;
}

export default function ReviewPantryScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  // Captured once, on mount — scanHandoff is a one-shot handoff from
  // scan-pantry.tsx, not a live external source to keep resyncing with.
  const [pending] = useState(() => scanHandoff.pantry ?? null);
  const [wellStocked] = useState<string[]>(pending?.extraction.visible_items ?? []);
  const [candidates, setCandidates] = useState<CheckableItem[]>(
    pending?.extraction.running_low_or_missing.map((label) => ({
      label,
      checked: true,
      onList: false,
    })) ?? []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Flag suggestions that are already on the list so nothing gets added twice.
  useEffect(() => {
    if (!user || !pending) return;
    let isMounted = true;
    (async () => {
      try {
        const list = await getOrCreateDefaultGroceryList(supabase, user.id);
        const existing = new Set(
          (await listGroceryItems(supabase, list.id)).map((i) => i.label.trim().toLowerCase())
        );
        if (!isMounted) return;
        setCandidates((prev) =>
          prev.map((item) =>
            existing.has(item.label.trim().toLowerCase())
              ? { ...item, checked: false, onList: true }
              : item
          )
        );
      } catch {
        // Best effort — the list still saves; worst case a duplicate the user can remove.
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user, pending]);

  function toggle(index: number) {
    setCandidates((prev) =>
      prev.map((item, i) =>
        i === index && !item.onList ? { ...item, checked: !item.checked } : item
      )
    );
  }

  function setAll(checked: boolean) {
    setCandidates((prev) => prev.map((item) => (item.onList ? item : { ...item, checked })));
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
      setErrorMessage(
        error instanceof Error ? error.message : 'We couldn’t add those. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleAskForMeals() {
    const have = wellStocked.length > 0 ? `I have: ${wellStocked.join(', ')}. ` : '';
    const low =
      candidates.length > 0 ? `I'm low on: ${candidates.map((c) => c.label).join(', ')}. ` : '';
    const prompt = `${have}${low}What are a few simple, budget-friendly meals I could make, and what should I pick up?`;
    router.push({ pathname: '/helper', params: { prompt } });
  }

  if (!pending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Review pantry scan' }} />
        <EmptyState
          mascot
          title="No pantry scan to review"
          message="Scan your pantry or fridge first and the suggestions will show up here."
          action={
            <Button
              label="Scan pantry"
              variant="panel"
              onPress={() => router.replace('/scan-pantry')}
            />
          }
        />
      </Screen>
    );
  }

  const selectedCount = candidates.filter((c) => c.checked).length;
  const selectable = candidates.filter((c) => !c.onList);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Review pantry scan' }} />
      <ScreenHeader
        title="Pantry suggestions"
        subtitle="Pick what goes on your grocery list — nothing is added until you say so."
      />

      <Grid>
        <View style={{ flexGrow: 1, flexBasis: 340 }}>
          <SectionCard
            title="Suggested grocery list"
            action={
              selectable.length > 0 ? (
                <Button
                  label={selectedCount === selectable.length ? 'Clear all' : 'Select all'}
                  variant="quiet"
                  onPress={() => setAll(selectedCount !== selectable.length)}
                />
              ) : null
            }
          >
            {candidates.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                Nothing stood out as low or missing — your shelves look good.
              </ThemedText>
            ) : (
              <View>
                {candidates.map((item, index) => (
                  <Pressable
                    key={`${item.label}-${index}`}
                    accessibilityRole="checkbox"
                    accessibilityLabel={
                      item.onList ? `${item.label}, already on your list` : item.label
                    }
                    accessibilityState={{ checked: item.checked, disabled: item.onList }}
                    disabled={item.onList}
                    onPress={() => toggle(index)}
                    style={{
                      minHeight: Layout.minimumTouchTarget + Space[1],
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: Space[3],
                      borderTopWidth: 1,
                      borderTopColor: theme.border,
                      opacity: item.onList ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: item.checked ? theme.primary : theme.controlBorder,
                        backgroundColor: item.checked ? theme.primaryMuted : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.checked ? (
                        <ThemedText
                          type="smallBold"
                          themeColor="primary"
                          style={{ lineHeight: 18 }}
                        >
                          ✓
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={{ flex: 1 }}>{item.label}</ThemedText>
                    {item.onList ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Already on your list
                      </ThemedText>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}
          </SectionCard>
        </View>

        <View style={{ flexGrow: 1, flexBasis: 340, gap: Space[5] }}>
          <SectionCard title="Meal ideas">
            <View style={{ gap: Space[3] }}>
              <ThemedText themeColor="textSecondary">
                Ask Budget Buddy for simple, budget-friendly meals using what you have. It uses one
                Budget Buddy message.
              </ThemedText>
              <View style={{ flexDirection: 'row' }}>
                <Button label="Ask Budget Buddy" variant="secondary" onPress={handleAskForMeals} />
              </View>
            </View>
          </SectionCard>

          {wellStocked.length > 0 ? (
            <SectionCard title="Looks well stocked">
              <View>
                {wellStocked.map((label) => (
                  <View
                    key={label}
                    style={{
                      minHeight: Layout.minimumTouchTarget,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: Space[3],
                      borderTopWidth: 1,
                      borderTopColor: theme.border,
                    }}
                  >
                    <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
                    <StatusPill label="In stock" tone="success" />
                  </View>
                ))}
              </View>
            </SectionCard>
          ) : null}
        </View>
      </Grid>

      {errorMessage ? (
        <Card>
          <ThemedText themeColor="warning" accessibilityLiveRegion="polite">
            {errorMessage}
          </ThemedText>
        </Card>
      ) : null}

      <Button
        label={isSaving ? 'Adding…' : `Add ${selectedCount} to grocery list`}
        variant="panel"
        onPress={handleAddToGroceryList}
        disabled={isSaving || selectedCount === 0}
      />
    </Screen>
  );
}
