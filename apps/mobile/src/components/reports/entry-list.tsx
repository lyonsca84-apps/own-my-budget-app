import { View } from 'react-native';
import { formatCents, type ReportEntry } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Layout, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { formatShortDate } from './format';

/** Individual payments/receipts behind a category, newest first — label, date and amount per row. */
export function EntryList({ entries }: { entries: ReportEntry[] }) {
  const theme = useTheme();

  return (
    <View>
      {entries.map((entry) => (
        <View
          key={entry.id}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: Space[3],
            minHeight: Layout.minimumTouchTarget,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingVertical: Space[2],
          }}
        >
          <View style={{ flexShrink: 1 }}>
            <ThemedText>{entry.label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatShortDate(entry.date)}
            </ThemedText>
          </View>
          <ThemedText type="amountSmall">{formatCents(entry.amountCents)}</ThemedText>
        </View>
      ))}
    </View>
  );
}
