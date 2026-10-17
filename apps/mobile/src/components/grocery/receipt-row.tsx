import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { listReceiptItems, type Tables } from '@own-my-budget/api';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { formatShortDate } from '@/components/reports/format';
import { Layout, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export interface ReceiptRowProps {
  store: string;
  /** YYYY-MM-DD, or null when the scan couldn't read a date. */
  date: string | null;
  amountCents: number;
  /** When set, tapping the row loads and shows the receipt's line items. */
  receiptId?: string;
}

/**
 * The design's "Store · date · auto-categorized as Groceries — $amount" row.
 * Real receipts expand on tap to show what was on them; sample rows (guest
 * mode) just sit there.
 */
export function ReceiptRow({ store, date, amountCents, receiptId }: ReceiptRowProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Tables<'receipt_items'>[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && items === null && receiptId) {
      try {
        setFailed(false);
        setItems(await listReceiptItems(supabase, receiptId));
      } catch {
        setFailed(true);
      }
    }
  }

  const canExpand = !!receiptId;
  const summary = `${store}, ${formatShortDate(date)}, ${formatCents(amountCents)}`;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
      <Pressable
        accessibilityRole={canExpand ? 'button' : undefined}
        accessibilityLabel={canExpand ? `${summary}. ${isOpen ? 'Hide' : 'Show'} items` : summary}
        accessibilityState={canExpand ? { expanded: isOpen } : undefined}
        disabled={!canExpand}
        onPress={toggle}
        style={{
          minHeight: Layout.minimumTouchTarget + Space[3],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: Space[3],
          paddingVertical: Space[3],
        }}
      >
        <View style={{ flexShrink: 1, gap: 2 }}>
          <ThemedText type="smallBold">{store}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatShortDate(date)} · auto-categorized as Groceries
          </ThemedText>
        </View>
        <ThemedText type="amountSmall">{formatCents(amountCents)}</ThemedText>
      </Pressable>

      {isOpen ? (
        <View style={{ paddingBottom: Space[3], gap: Space[1] }}>
          {failed ? (
            <ThemedText type="small" themeColor="warning">
              We couldn&rsquo;t load the items for this receipt.
            </ThemedText>
          ) : items === null ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading items…
            </ThemedText>
          ) : items.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No line items were saved with this receipt.
            </ThemedText>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space[3] }}
              >
                <ThemedText type="small" style={{ flexShrink: 1 }}>
                  {item.label}
                  {item.quantity !== 1 ? ` × ${item.quantity}` : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatCents(item.price_cents)}
                </ThemedText>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
