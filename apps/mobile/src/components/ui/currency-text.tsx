import { formatCents } from '@own-my-budget/core';
import type { StyleProp, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { ThemeColor } from '@/constants/theme';

export type CurrencySize = 'display' | 'amount' | 'row';

const TYPE_BY_SIZE: Record<CurrencySize, 'display' | 'amount' | 'amountSmall'> = {
  display: 'display',
  amount: 'amount',
  row: 'amountSmall',
};

export interface CurrencyTextProps {
  cents: number;
  /** display=64px hero figure, amount=34px card figure, row=18px list-row figure. */
  size?: CurrencySize;
  themeColor?: ThemeColor;
  style?: StyleProp<TextStyle>;
}

/**
 * Every money figure in the app renders through this component so Poppins +
 * tabular numerals are never something a screen has to remember to add.
 */
export function CurrencyText({ cents, size = 'amount', themeColor, style }: CurrencyTextProps) {
  return (
    <ThemedText type={TYPE_BY_SIZE[size]} themeColor={themeColor} style={style}>
      {formatCents(cents)}
    </ThemedText>
  );
}
