import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveReceipt, type ReceiptExtraction } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { scanHandoff } from '@/lib/scan-handoff';
import { Spacing } from '@/constants/theme';

interface EditableItem {
  label: string;
  category: string;
  price: string;
  quantity: string;
  removed: boolean;
}

function toEditableItems(extraction: ReceiptExtraction): EditableItem[] {
  return extraction.items.map((item) => ({
    label: item.label,
    category: item.category ?? '',
    price: (item.price_cents / 100).toFixed(2),
    quantity: String(item.quantity),
    removed: false,
  }));
}

export default function ReviewReceiptScreen() {
  const { user } = useAuth();
  // Captured once, on mount — scanHandoff is a one-shot handoff from
  // scan-receipt.tsx, not a live external source to keep resyncing with.
  const [pending] = useState(() => scanHandoff.receipt ?? null);
  const extraction = pending?.extraction ?? null;

  const [storeLabel, setStoreLabel] = useState(extraction?.store_label ?? '');
  const [purchasedOn, setPurchasedOn] = useState(extraction?.purchased_on ?? '');
  const [subtotal, setSubtotal] = useState(
    extraction?.subtotal_cents != null ? (extraction.subtotal_cents / 100).toFixed(2) : ''
  );
  const [tax, setTax] = useState(
    extraction?.tax_cents != null ? (extraction.tax_cents / 100).toFixed(2) : ''
  );
  const [total, setTotal] = useState(
    extraction?.total_cents != null ? (extraction.total_cents / 100).toFixed(2) : ''
  );
  const [items, setItems] = useState<EditableItem[]>(extraction ? toEditableItems(extraction) : []);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) router.back();
  }, [pending]);

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function parseDollarsToCents(value: string): number | null {
    if (!value.trim()) return null;
    const cents = Math.round(parseFloat(value) * 100);
    return Number.isFinite(cents) ? cents : null;
  }

  async function handleConfirmAndSave() {
    if (!user) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await saveReceipt(supabase, {
        user_id: user.id,
        store_label: storeLabel.trim() || null,
        purchased_on: purchasedOn.trim() || null,
        subtotal_cents: parseDollarsToCents(subtotal),
        tax_cents: parseDollarsToCents(tax),
        total_cents: parseDollarsToCents(total),
        image_storage_path: null,
        items: items
          .filter((item) => !item.removed && item.label.trim())
          .map((item) => ({
            label: item.label.trim(),
            category: item.category.trim() || null,
            price_cents: parseDollarsToCents(item.price) ?? 0,
            quantity: parseFloat(item.quantity) || 1,
          })),
      });
      scanHandoff.receipt = undefined;
      router.dismissTo('/(tabs)/helper');
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
            Review &amp; correct
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Nothing saves until you confirm. Fix anything the scan got wrong.
          </ThemedText>

          <TextField label="Store" value={storeLabel} onChangeText={setStoreLabel} />
          <TextField
            label="Date (YYYY-MM-DD)"
            value={purchasedOn}
            onChangeText={setPurchasedOn}
            placeholder="YYYY-MM-DD"
          />

          <ThemedText type="smallBold">Items</ThemedText>
          {items.length === 0 ? (
            <ThemedText themeColor="textSecondary">No items were detected.</ThemedText>
          ) : (
            items.map((item, index) =>
              item.removed ? null : (
                <Card key={index} style={{ gap: Spacing.two }}>
                  <TextField
                    label="Item"
                    value={item.label}
                    onChangeText={(value) => updateItem(index, { label: value })}
                  />
                  <TextField
                    label="Category"
                    value={item.category}
                    onChangeText={(value) => updateItem(index, { category: value })}
                  />
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label="Price"
                        value={item.price}
                        onChangeText={(value) => updateItem(index, { price: value })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label="Qty"
                        value={item.quantity}
                        onChangeText={(value) => updateItem(index, { quantity: value })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <Button
                    label="Remove item"
                    variant="secondary"
                    onPress={() => updateItem(index, { removed: true })}
                  />
                </Card>
              )
            )
          )}

          <TextField
            label="Subtotal"
            value={subtotal}
            onChangeText={setSubtotal}
            keyboardType="decimal-pad"
          />
          <TextField label="Tax" value={tax} onChangeText={setTax} keyboardType="decimal-pad" />
          <TextField
            label="Total"
            value={total}
            onChangeText={setTotal}
            keyboardType="decimal-pad"
          />

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}

          <Button
            label={isSaving ? 'Saving…' : 'Confirm & save'}
            onPress={handleConfirmAndSave}
            disabled={isSaving}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
