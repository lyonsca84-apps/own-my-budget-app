import { View } from 'react-native';
import type { BudgetCategoryRow } from '@own-my-budget/core';
import { formatCents } from '@own-my-budget/core';

import { AmountInput } from '@/components/budget/amount-input';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress-bar';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { Space } from '@/constants/theme';

const STATE_TONE: Record<BudgetCategoryRow['state'], StatusTone> = {
  unplanned: 'neutral',
  'on-track': 'success',
  near: 'neutral',
  // Over budget is a calm "watch" (amber) — clay/red is reserved for overdue bills.
  over: 'warning',
};

const PROGRESS_TONE: Record<BudgetCategoryRow['state'], ProgressTone> = {
  unplanned: 'primary',
  'on-track': 'primary',
  near: 'primary',
  over: 'watch',
};

function stateLabel(row: BudgetCategoryRow): string {
  switch (row.state) {
    case 'over':
      return `${formatCents(row.overCents)} over`;
    case 'near':
      return `${formatCents(row.remainingCents)} left · close to plan`;
    case 'on-track':
      return `${formatCents(row.remainingCents)} left`;
    default:
      return row.actualCents > 0 ? 'No plan set' : 'Not planned yet';
  }
}

export interface BudgetCategoryRowViewProps {
  row: BudgetCategoryRow;
  periodLabel: string;
  editable: boolean;
  onPlannedCommit: (cents: number | null) => void;
  onActualCommit: (cents: number | null) => void;
  onResetActual: () => void;
}

/** One category's planned vs. actual: name, status, inline amount fields, and a progress bar. */
export function BudgetCategoryRowView({
  row,
  periodLabel,
  editable,
  onPlannedCommit,
  onActualCommit,
  onResetActual,
}: BudgetCategoryRowViewProps) {
  const percent = row.plannedCents > 0 ? (row.actualCents / row.plannedCents) * 100 : 0;
  const summary = `${formatCents(row.actualCents)} of ${formatCents(row.plannedCents)} planned. ${stateLabel(row)}.`;

  return (
    <View style={{ gap: Space[3] }} accessible={false}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: Space[2],
        }}
      >
        <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
          {row.name}
        </ThemedText>
        <StatusPill label={stateLabel(row)} tone={STATE_TONE[row.state]} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
        <AmountInput
          label="Actual"
          accessibilityLabel={`Amount spent on ${row.name} in ${periodLabel}`}
          cents={row.actualCents}
          editable={editable}
          onCommit={(cents) => onActualCommit(cents)}
        />
        <AmountInput
          label="Planned"
          accessibilityLabel={`Amount planned for ${row.name} in ${periodLabel}`}
          cents={row.plannedCents}
          editable={editable}
          onCommit={(cents) => onPlannedCommit(cents ?? 0)}
        />
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${row.name} budget used`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.min(100, Math.round(percent)),
          text: summary,
        }}
        style={{ gap: Space[1] }}
      >
        <ProgressBar percent={percent} tone={PROGRESS_TONE[row.state]} />
        <ThemedText type="small" themeColor="textSecondary">
          {row.percentUsed !== null ? `${row.percentUsed}% of plan` : 'No plan set'}
          {row.isOverridden ? ' · amount edited by you' : ''}
        </ThemedText>
      </View>

      {row.isOverridden && editable ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label={`Use tracked ${formatCents(row.trackedCents)}`}
            variant="quiet"
            accessibilityLabel={`Use the tracked amount of ${formatCents(row.trackedCents)} for ${row.name}`}
            onPress={onResetActual}
          />
        </View>
      ) : null}
    </View>
  );
}
