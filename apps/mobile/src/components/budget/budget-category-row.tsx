import { View } from 'react-native';
import type { BudgetBarPercents, BudgetCategoryRow } from '@own-my-budget/core';
import { formatCents, formatCentsCompact } from '@own-my-budget/core';

import { AmountInput } from '@/components/budget/amount-input';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The right-hand verdict: text says it, color only backs it up. Over is calm amber, never red. */
function delta(row: BudgetCategoryRow): { label: string; color: ThemeColor } {
  if (row.state === 'over')
    return { label: `${formatCentsCompact(row.overCents)} over`, color: 'warning' };
  if (row.plannedCents <= 0) return { label: 'No plan set', color: 'textSecondary' };
  return { label: `${formatCentsCompact(row.remainingCents)} under`, color: 'success' };
}

export interface BudgetCategoryRowViewProps {
  row: BudgetCategoryRow;
  bar: BudgetBarPercents;
  periodLabel: string;
  onPlannedCommit: (cents: number | null) => void;
  onActualCommit: (cents: number | null) => void;
  onResetActual: () => void;
}

/**
 * One category's planned vs. actual, as in the design: name, "$ [actual] of
 * $ [planned]" inline number fields with the under/over verdict, a lavender
 * planned bar with the actual bar over it, and "N% of plan".
 */
export function BudgetCategoryRowView({
  row,
  bar,
  periodLabel,
  onPlannedCommit,
  onActualCommit,
  onResetActual,
}: BudgetCategoryRowViewProps) {
  const theme = useTheme();
  const verdict = delta(row);
  const isOver = row.state === 'over';
  const summary = `${formatCents(row.actualCents)} of ${formatCents(row.plannedCents)} planned. ${verdict.label}.`;

  return (
    <View style={{ gap: Space[2] }} accessible={false}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          columnGap: Space[4],
          rowGap: Space[2],
        }}
      >
        <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
          {row.name}
        </ThemedText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: Space[2],
            maxWidth: '100%',
          }}
        >
          <AmountInput
            accessibilityLabel={`Amount spent on ${row.name} in ${periodLabel}`}
            cents={row.actualCents}
            onCommit={(cents) => onActualCommit(cents)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            of
          </ThemedText>
          <AmountInput
            tone="muted"
            accessibilityLabel={`Amount planned for ${row.name} in ${periodLabel}`}
            cents={row.plannedCents}
            onCommit={(cents) => onPlannedCommit(cents ?? 0)}
          />
          <ThemedText type="smallBold" themeColor={verdict.color} style={{ flexShrink: 1 }}>
            {verdict.label}
          </ThemedText>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${row.name} budget used`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.min(100, Math.max(0, row.percentUsed ?? 0)),
          text: summary,
        }}
        style={{ gap: Space[1] }}
      >
        <View
          style={{
            height: 10,
            borderRadius: Radius.full,
            backgroundColor: theme.backgroundSelected,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${bar.plannedPercent}%`,
              borderRadius: Radius.full,
              backgroundColor: theme.primaryMuted,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${bar.actualPercent}%`,
              borderRadius: Radius.full,
              backgroundColor: isOver ? theme.warningSolid : theme.primary,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: Space[2],
          }}
        >
          <ThemedText type="small" themeColor="textSecondary">
            {row.percentUsed !== null ? `${row.percentUsed}% of plan` : 'No plan set'}
            {row.isOverridden ? ' · amount edited by you' : ''}
          </ThemedText>
          {row.isOverridden ? (
            <Button
              label={`Use tracked ${formatCents(row.trackedCents)}`}
              variant="quiet"
              size="sm"
              accessibilityLabel={`Use the tracked amount of ${formatCents(row.trackedCents)} for ${row.name}`}
              onPress={onResetActual}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
