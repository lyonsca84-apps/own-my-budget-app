import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BillsSubTab = 'bills' | 'cards' | 'loans' | 'payoff';

const TABS: { value: BillsSubTab; label: string }[] = [
  { value: 'bills', label: 'Bills' },
  { value: 'cards', label: 'Credit Cards' },
  { value: 'loans', label: 'Loans & Mortgages' },
  { value: 'payoff', label: 'Payoff Plan' },
];

/**
 * The four Bills & Debt views. A wrapping tab list rather than the shared
 * SegmentedControl (which never wraps) so all four stay reachable at 400px
 * and in large-text settings without sideways scrolling.
 */
export function BillsSubTabs({
  value,
  onChange,
}: {
  value: BillsSubTab;
  onChange: (value: BillsSubTab) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignSelf: 'flex-start',
        backgroundColor: theme.backgroundSelected,
        borderRadius: 26,
        padding: 4,
        gap: 2,
      }}
    >
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={{
              minHeight: 44,
              paddingHorizontal: Space[4],
              borderRadius: Radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.panel : 'transparent',
            }}
          >
            <ThemedText type="smallBold" themeColor={selected ? 'onPanel' : 'textSecondary'}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
