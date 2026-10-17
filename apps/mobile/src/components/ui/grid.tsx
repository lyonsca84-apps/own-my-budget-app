import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Space } from '@/constants/theme';

export interface GridProps {
  children: ReactNode;
  gap?: number;
}

/**
 * A wrapping row for cards that size themselves with `flexGrow`/`flexBasis`
 * (StatTile, GoalCard) — collapses to one column on narrow widths and to as
 * many columns as fit at wider ones, without a fixed breakpoint list.
 */
export function Grid({ children, gap = Space[5] }: GridProps) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>;
}
