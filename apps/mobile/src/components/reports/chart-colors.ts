import type { AllocationKey, ReportEntryKind } from '@own-my-budget/core';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The design system's fixed chart mapping — Bills=Panel, Debt=Sky,
 * Groceries=Electricity, Savings=Ecology, Available=Energy — resolved
 * through the theme so Panel and Sky stay visible in dark mode (Panel
 * flips to paper there). Ecology has no semantic theme role, so it's the
 * raw brand green in both modes. Charts always pair these with text labels
 * and values; color is never the only signal.
 */
export function useChartColors(): Record<AllocationKey, string> {
  const theme = useTheme();
  return {
    bills: theme.panel,
    debt: theme.primary,
    groceries: theme.accent,
    savings: Brand.ecology,
    available: theme.energy,
  };
}

/** Category-bar color for a report entry kind (bills use Panel, debt Sky, groceries Electricity). */
export function useKindColor(): Record<ReportEntryKind, string> {
  const colors = useChartColors();
  return { bill: colors.bills, debt: colors.debt, grocery: colors.groceries };
}
