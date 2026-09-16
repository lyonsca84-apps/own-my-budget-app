import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CurrencyText } from '@/components/ui/currency-text';
import { Space } from '@/constants/theme';

export interface BillRowProps {
  label: string;
  caption: string;
  amountCents: number;
  /** A StatusPill for a settled state, or a Button for the action still needed — the row stays business-logic-free. */
  trailing: ReactNode;
}

/** The label/caption-left, amount/status-or-action-right row used for bills, debts, and paychecks. */
export function BillRow({ label, caption, amountCents, trailing }: BillRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Space[3],
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <ThemedText>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: Space[1] }}>
        <CurrencyText cents={amountCents} size="row" />
        {trailing}
      </View>
    </View>
  );
}
