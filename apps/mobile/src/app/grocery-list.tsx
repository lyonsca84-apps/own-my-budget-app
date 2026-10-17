import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  addGroceryItems,
  clearCheckedGroceryItems,
  deleteGroceryItem,
  getOrCreateDefaultGroceryList,
  listGroceryItems,
  listReceipts,
  toggleGroceryItem,
  type Tables,
} from '@own-my-budget/api';
import { DEMO_DATA, formatCents, formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { describeRemainingScans, useScanGate } from '@/components/grocery/use-scan-gate';
import { ReceiptRow } from '@/components/grocery/receipt-row';
import { ScanDropCard } from '@/components/grocery/scan-drop-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Grid } from '@/components/ui/grid';
import { LimitNotice } from '@/components/ui/limit-notice';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { Layout, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { WideSidebarFrame } from '@/components/wide-sidebar-frame';

interface ReceiptSummary {
  id: string | undefined;
  store: string;
  date: string | null;
  amountCents: number;
}

/** Guest mode: the sample dataset's grocery transactions, shaped like real receipts. */
function demoReceipts(): ReceiptSummary[] {
  return DEMO_DATA.transactions
    .filter((t) => t.category === 'Groceries' && t.amountCents < 0)
    .map((t) => ({ id: undefined, store: t.label, date: t.date, amountCents: -t.amountCents }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

function GroceryScreen() {
  const { status, user } = useAuth();
  const theme = useTheme();
  const isGuest = status === 'guest';
  const receiptGate = useScanGate('receiptScan');
  const pantryGate = useScanGate('pantryScan');

  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<Tables<'grocery_items'>[]>([]);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [isLoading, setIsLoading] = useState(status === 'signedIn');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setErrorMessage(null);
    try {
      const [list, saved] = await Promise.all([
        getOrCreateDefaultGroceryList(supabase, user.id),
        listReceipts(supabase, user.id),
      ]);
      setListId(list.id);
      setItems(await listGroceryItems(supabase, list.id));
      setReceipts(
        saved.map((r) => ({
          id: r.id,
          store: r.store_label?.trim() || 'Grocery receipt',
          date: r.purchased_on,
          amountCents: r.total_cents ?? 0,
        }))
      );
    } catch {
      setErrorMessage("We couldn't load your grocery data just now. Pull down or try again.");
    } finally {
      setIsLoading(false);
    }
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
    try {
      await toggleGroceryItem(supabase, itemId, isChecked);
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, is_checked: !isChecked } : item))
      );
      setErrorMessage("That change didn't save. Please try again.");
    }
  }

  async function handleAddItem() {
    if (!user || !listId || !newItemLabel.trim()) return;
    const label = newItemLabel.trim();
    setNewItemLabel('');
    try {
      const [created] = await addGroceryItems(supabase, user.id, listId, [label]);
      if (created) setItems((prev) => [...prev, created]);
    } catch {
      setNewItemLabel(label);
      setErrorMessage("We couldn't add that item. Please try again.");
    }
  }

  async function handleRemove(itemId: string) {
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    try {
      await deleteGroceryItem(supabase, itemId);
    } catch {
      setItems(previous);
      setErrorMessage("We couldn't remove that item. Please try again.");
    }
  }

  async function handleClearChecked() {
    if (!listId) return;
    const previous = items;
    setItems((prev) => prev.filter((item) => !item.is_checked));
    try {
      await clearCheckedGroceryItems(supabase, listId);
    } catch {
      setItems(previous);
      setErrorMessage("We couldn't clear those items. Please try again.");
    }
  }

  const shownReceipts = isGuest ? demoReceipts() : receipts;

  // "This month" for real accounts; a guest sees the sample data's latest month so the tile isn't a bare $0.
  const latestDate = shownReceipts.map((r) => r.date).find(Boolean) ?? null;
  const monthPrefix =
    isGuest && latestDate ? latestDate.slice(0, 7) : formatLocalDate(new Date()).slice(0, 7);
  const monthReceipts = shownReceipts.filter((r) => r.date?.startsWith(monthPrefix));
  const monthSpendCents = monthReceipts.reduce((sum, r) => sum + r.amountCents, 0);
  const monthLabel = isGuest && latestDate ? 'in the sample month' : 'this month';

  const uncheckedCount = items.filter((i) => !i.is_checked).length;
  const checkedCount = items.length - uncheckedCount;
  const estimatedRemainingCents = items
    .filter((item) => !item.is_checked)
    .reduce((sum, item) => sum + (item.estimated_price_cents ?? 0), 0);

  const receiptBlocked = receiptGate.gate !== null && !receiptGate.gate.allowed;
  const pantryBlocked = pantryGate.gate !== null && !pantryGate.gate.allowed;

  return (
    <Screen showGuestBanner>
      <Stack.Screen options={{ title: 'Grocery & Receipts' }} />
      <ScreenHeader title="Grocery & Receipts" subtitle="Receipts and pantry-based suggestions." />

      <Grid>
        <ScanDropCard
          title="Scan a receipt"
          prompt="Tap to scan a receipt photo"
          hint="We read it for you — you review everything before it saves."
          glyph="▤"
          onPress={() => router.push('/scan-receipt')}
          footnote={describeRemainingScans(receiptGate.gate)}
        />
        <ScanDropCard
          title="Pantry / fridge photo"
          prompt="Tap to analyze a pantry photo"
          hint="We suggest what looks low — you pick what goes on your list."
          glyph="◫"
          onPress={() => router.push('/scan-pantry')}
          footnote={describeRemainingScans(pantryGate.gate)}
        />
      </Grid>

      {receiptBlocked && receiptGate.gate?.reason ? (
        <LimitNotice reason={receiptGate.gate.reason} />
      ) : pantryBlocked && pantryGate.gate?.reason ? (
        <LimitNotice reason={pantryGate.gate.reason} />
      ) : null}

      {errorMessage ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText themeColor="warning" accessibilityLiveRegion="polite">
            {errorMessage}
          </ThemedText>
          {!isGuest ? (
            <View style={{ flexDirection: 'row' }}>
              <Button label="Try again" variant="secondary" onPress={reload} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Grid>
        <View style={{ flexGrow: 1, flexBasis: 360, gap: Space[5] }}>
          <StatTile
            label={`Groceries ${monthLabel}`}
            valueCents={monthSpendCents}
            glyph="●"
            glyphColor="accent"
            glyphTint="accentMuted"
            description={
              monthReceipts.length > 0
                ? `From ${monthReceipts.length} receipt${monthReceipts.length === 1 ? '' : 's'}.`
                : 'Scan a receipt and your grocery spending shows up here.'
            }
          />

          <SectionCard
            title="Your grocery list"
            action={
              estimatedRemainingCents > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Est. {formatCents(estimatedRemainingCents)} left
                </ThemedText>
              ) : null
            }
          >
            {isGuest ? (
              <View style={{ gap: Space[3] }}>
                <ThemedText themeColor="textSecondary">
                  Create a free account to keep a grocery list and pull in items from pantry scans.
                </ThemedText>
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    label="Create an account"
                    variant="panel"
                    onPress={() => router.push('/sign-up')}
                  />
                </View>
              </View>
            ) : isLoading ? (
              <ThemedText themeColor="textSecondary">Loading…</ThemedText>
            ) : (
              <View style={{ gap: Space[3] }}>
                {items.length === 0 ? (
                  <ThemedText themeColor="textSecondary">
                    Your list is empty. Add an item below, or scan your pantry for suggestions.
                  </ThemedText>
                ) : (
                  <View>
                    {items.map((item) => (
                      <View
                        key={item.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderTopWidth: 1,
                          borderTopColor: theme.border,
                        }}
                      >
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={item.label}
                          accessibilityState={{ checked: item.is_checked }}
                          onPress={() => handleToggle(item.id, !item.is_checked)}
                          style={{
                            flex: 1,
                            minHeight: Layout.minimumTouchTarget + Space[1],
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: Space[3],
                          }}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: item.is_checked ? theme.success : theme.controlBorder,
                              backgroundColor: item.is_checked ? theme.successMuted : 'transparent',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.is_checked ? (
                              <ThemedText
                                type="smallBold"
                                themeColor="success"
                                style={{ lineHeight: 18 }}
                              >
                                ✓
                              </ThemedText>
                            ) : null}
                          </View>
                          <ThemedText
                            style={{
                              flexShrink: 1,
                              textDecorationLine: item.is_checked ? 'line-through' : 'none',
                            }}
                            themeColor={item.is_checked ? 'textSecondary' : 'text'}
                          >
                            {item.label}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.label}`}
                          onPress={() => handleRemove(item.id)}
                          style={{
                            minWidth: Layout.minimumTouchTarget,
                            minHeight: Layout.minimumTouchTarget,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: Radius.input,
                          }}
                        >
                          <ThemedText themeColor="textSecondary">✕</ThemedText>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {items.length > 0 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: Space[3],
                    }}
                  >
                    <ThemedText type="small" themeColor="textSecondary">
                      {uncheckedCount} to get · {checkedCount} checked off
                    </ThemedText>
                    {checkedCount > 0 ? (
                      <Button label="Clear checked" variant="quiet" onPress={handleClearChecked} />
                    ) : null}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Add an item"
                      value={newItemLabel}
                      onChangeText={setNewItemLabel}
                      placeholder="e.g. Milk"
                      onSubmitEditing={handleAddItem}
                      returnKeyType="done"
                    />
                  </View>
                  <Button label="Add" onPress={handleAddItem} disabled={!newItemLabel.trim()} />
                </View>
              </View>
            )}
          </SectionCard>
        </View>

        <View style={{ flexGrow: 1, flexBasis: 360 }}>
          <SectionCard title="Recent grocery expenses">
            {!isGuest && isLoading ? (
              <ThemedText themeColor="textSecondary">Loading…</ThemedText>
            ) : shownReceipts.length === 0 ? (
              <View style={{ gap: Space[3] }}>
                <ThemedText themeColor="textSecondary">
                  No receipts yet. Scan your first one and it will be filed under Groceries
                  automatically.
                </ThemedText>
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    label="Scan a receipt"
                    variant="secondary"
                    onPress={() => router.push('/scan-receipt')}
                  />
                </View>
              </View>
            ) : (
              <View>
                {shownReceipts.slice(0, 12).map((receipt, index) => (
                  <ReceiptRow
                    key={receipt.id ?? `demo-${index}`}
                    receiptId={receipt.id}
                    store={receipt.store}
                    date={receipt.date}
                    amountCents={receipt.amountCents}
                  />
                ))}
              </View>
            )}
          </SectionCard>
        </View>
      </Grid>
    </Screen>
  );
}

export default function GroceryListRoute() {
  return (
    <WideSidebarFrame>
      <GroceryScreen />
    </WideSidebarFrame>
  );
}
