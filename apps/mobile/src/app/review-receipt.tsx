import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { saveReceipt, type ReceiptExtraction } from '@own-my-budget/api';
import { formatCents, formatLocalDate, parseLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { scanHandoff } from '@/lib/scan-handoff';

interface EditableItem {
  key: number;
  label: string;
  category: string;
  price: string;
  quantity: string;
  removed: boolean;
}

function toEditableItems(extraction: ReceiptExtraction): EditableItem[] {
  return extraction.items.map((item, index) => ({
    key: index,
    label: item.label,
    category: item.category ?? '',
    price: (item.price_cents / 100).toFixed(2),
    quantity: String(item.quantity),
    removed: false,
  }));
}

function parseDollarsToCents(value: string): number | null {
  if (!value.trim()) return null;
  const cents = Math.round(parseFloat(value.replace(/[$,]/g, '')) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/** The scan handoff is one-shot: once reviewed (saved or discarded) it must not linger. */
function clearReceiptHandoff() {
  scanHandoff.receipt = undefined;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatLocalDate(parseLocalDate(value)) === value;
}

export default function ReviewReceiptScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  // Captured once, on mount — scanHandoff is a one-shot handoff from
  // scan-receipt.tsx, not a live external source to keep resyncing with.
  const [pending] = useState(() => scanHandoff.receipt ?? null);
  const extraction = pending?.extraction ?? null;

  const [storeLabel, setStoreLabel] = useState(extraction?.store_label ?? '');
  const [purchasedOn, setPurchasedOn] = useState(
    extraction?.purchased_on ?? formatLocalDate(new Date())
  );
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
  const [dateError, setDateError] = useState<string | undefined>();

  if (!pending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Review receipt' }} />
        <EmptyState
          mascot
          title="No receipt to review"
          message="Scan a receipt first and it will show up here so you can check it."
          action={
            <Button
              label="Scan a receipt"
              variant="panel"
              onPress={() => router.replace('/scan-receipt')}
            />
          }
        />
      </Screen>
    );
  }

  const liveItems = items.filter((item) => !item.removed);
  const itemsTotalCents = liveItems.reduce(
    (sum, item) => sum + (parseDollarsToCents(item.price) ?? 0) * (parseFloat(item.quantity) || 1),
    0
  );
  const enteredTotalCents = parseDollarsToCents(total);
  const totalsDiffer =
    enteredTotalCents !== null &&
    liveItems.length > 0 &&
    Math.abs(enteredTotalCents - itemsTotalCents) > 1;

  function updateItem(key: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: Math.max(-1, ...prev.map((i) => i.key)) + 1,
        label: '',
        category: '',
        price: '',
        quantity: '1',
        removed: false,
      },
    ]);
  }

  function handleDiscard() {
    clearReceiptHandoff();
    router.back();
  }

  async function handleConfirmAndSave() {
    if (!user) return;
    setErrorMessage(null);
    setDateError(undefined);

    const date = purchasedOn.trim();
    if (date && !isValidDateOnly(date)) {
      setDateError('Use the format YYYY-MM-DD, for example 2026-09-14.');
      return;
    }

    setIsSaving(true);
    try {
      const savedItems = liveItems
        .filter((item) => item.label.trim())
        .map((item) => ({
          label: item.label.trim(),
          category: item.category.trim() || null,
          price_cents: parseDollarsToCents(item.price) ?? 0,
          quantity: parseFloat(item.quantity) || 1,
        }));
      const subtotalCents = parseDollarsToCents(subtotal);
      const taxCents = parseDollarsToCents(tax);
      // A blank total would make this receipt invisible to Reports, so fall
      // back to what the reviewed items and tax add up to.
      const totalCents =
        parseDollarsToCents(total) ??
        (savedItems.length > 0
          ? (subtotalCents ??
              Math.round(savedItems.reduce((s, i) => s + i.price_cents * i.quantity, 0))) +
            (taxCents ?? 0)
          : null);

      await saveReceipt(supabase, {
        user_id: user.id,
        store_label: storeLabel.trim() || null,
        purchased_on: date || formatLocalDate(new Date()),
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        image_storage_path: null,
        items: savedItems,
      });
      clearReceiptHandoff();
      // The grocery screen is what launched the scan; dismiss back to it (or open it if needed).
      router.dismissTo('/grocery-list');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'We couldn’t save that. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Review receipt' }} />
      <ScreenHeader
        title="Review receipt"
        subtitle="Nothing saves until you confirm. Fix anything the scan got wrong."
      />

      <SectionCard title="Receipt details">
        <View style={{ gap: Space[3] }}>
          <TextField label="Store" value={storeLabel} onChangeText={setStoreLabel} />
          <TextField
            label="Date (YYYY-MM-DD)"
            value={purchasedOn}
            onChangeText={(value) => {
              setPurchasedOn(value);
              setDateError(undefined);
            }}
            placeholder="YYYY-MM-DD"
            errorMessage={dateError}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <TextField
                label="Subtotal"
                value={subtotal}
                onChangeText={setSubtotal}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <TextField label="Tax" value={tax} onChangeText={setTax} keyboardType="decimal-pad" />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <TextField
                label="Total"
                value={total}
                onChangeText={setTotal}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </SectionCard>

      <SectionCard
        title={`Items (${liveItems.length})`}
        action={
          <ThemedText type="small" themeColor="textSecondary">
            Items add up to {formatCents(Math.round(itemsTotalCents))}
          </ThemedText>
        }
      >
        <View style={{ gap: Space[4] }}>
          {liveItems.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              No items were detected. You can add them by hand, or just save the total.
            </ThemedText>
          ) : (
            liveItems.map((item) => (
              <View
                key={item.key}
                style={{
                  gap: Space[3],
                  paddingTop: Space[4],
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                }}
              >
                <TextField
                  label="Item"
                  value={item.label}
                  onChangeText={(value) => updateItem(item.key, { label: value })}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
                  <View style={{ flexGrow: 1, flexBasis: 100 }}>
                    <TextField
                      label="Price"
                      value={item.price}
                      onChangeText={(value) => updateItem(item.key, { price: value })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 80 }}>
                    <TextField
                      label="Qty"
                      value={item.quantity}
                      onChangeText={(value) => updateItem(item.key, { quantity: value })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flexGrow: 2, flexBasis: 140 }}>
                    <TextField
                      label="Category"
                      value={item.category}
                      onChangeText={(value) => updateItem(item.key, { category: value })}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    label="Remove item"
                    variant="quiet"
                    accessibilityLabel={`Remove ${item.label || 'this item'}`}
                    onPress={() => updateItem(item.key, { removed: true })}
                  />
                </View>
              </View>
            ))
          )}
          <View style={{ flexDirection: 'row' }}>
            <Button label="+ Add item" variant="secondary" onPress={addItem} />
          </View>
          {totalsDiffer ? (
            <ThemedText type="small" themeColor="textSecondary">
              The items add up to {formatCents(Math.round(itemsTotalCents))} but the total says{' '}
              {formatCents(enteredTotalCents ?? 0)}. That&rsquo;s fine if tax or fees make up the
              difference — just worth a glance.
            </ThemedText>
          ) : null}
        </View>
      </SectionCard>

      {errorMessage ? (
        <Card>
          <ThemedText themeColor="warning" accessibilityLiveRegion="polite">
            {errorMessage}
          </ThemedText>
        </Card>
      ) : null}

      <View style={{ gap: Space[3] }}>
        <Button
          label={isSaving ? 'Saving…' : 'Confirm & save'}
          variant="panel"
          onPress={handleConfirmAndSave}
          disabled={isSaving}
        />
        <Button label="Discard scan" variant="quiet" onPress={handleDiscard} disabled={isSaving} />
      </View>
    </Screen>
  );
}
