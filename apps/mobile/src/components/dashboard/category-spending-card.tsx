import { formatCents, type BudgetCategoryRow } from '@own-my-budget/core';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AmountInput } from '@/components/dashboard/amount-input';
import { Bar, Caption, ChipButton, DashCard } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CategorySpendingCardProps {
  rows: BudgetCategoryRow[];
  periodLabel: string;
  onSavePlanned: (categoryId: string, cents: number) => void;
  onSaveActual: (categoryId: string, cents: number | null) => void;
}

/**
 * Spending by Category: an inline "$ spent of $ planned" pair per category.
 * Saving a planned amount writes the budget line; saving a spent amount
 * writes its actual override — exactly what the Budget page does — and the
 * bar and percentage update from the saved values.
 */
export function CategorySpendingCard({
  rows,
  periodLabel,
  onSavePlanned,
  onSaveActual,
}: CategorySpendingCardProps) {
  const theme = useTheme();
  return (
    <DashCard
      title="Spending by Category"
      subtitle={`Edit spent or planned amounts for ${periodLabel} — changes save when you leave the field.`}
    >
      <View style={{ alignItems: 'flex-start' }}>
        <ChipButton label="View Budget" tone="soft" onPress={() => router.push('/plan')} />
      </View>
      {rows.length === 0 ? (
        <View style={{ gap: Space[2], alignItems: 'flex-start' }}>
          <Caption>
            No categories yet. Add one (like Groceries or Rent) to start planning this month.
          </Caption>
          <ChipButton label="Add a category" onPress={() => router.push('/add-category')} />
        </View>
      ) : (
        <View style={{ gap: Space[4] }}>
          {rows.map((row) => {
            const isOver = row.state === 'over';
            const percent = row.percentUsed ?? 0;
            const barColor = isOver
              ? theme.warningSolid
              : row.state === 'near'
                ? theme.energy
                : theme.successSolid;
            return (
              <View key={row.categoryId} style={{ gap: Space[2] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    columnGap: Space[3],
                    rowGap: Space[2],
                  }}
                >
                  <ThemedText
                    style={{
                      fontFamily: Fonts.body.bold,
                      fontSize: 15,
                      lineHeight: 22,
                      flexShrink: 1,
                    }}
                  >
                    {row.name}
                  </ThemedText>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: Space[2],
                    }}
                  >
                    <AmountInput
                      accessibilityLabel={`Amount spent on ${row.name} in ${periodLabel}`}
                      cents={row.actualCents}
                      onCommit={(cents) => onSaveActual(row.categoryId, cents)}
                    />
                    <Caption>of</Caption>
                    <AmountInput
                      tone="muted"
                      accessibilityLabel={`Amount planned for ${row.name} in ${periodLabel}`}
                      cents={row.plannedCents}
                      onCommit={(cents) => onSavePlanned(row.categoryId, cents ?? 0)}
                    />
                    <Caption bold style={{ minWidth: 76, fontSize: 13 }}>
                      · {row.percentUsed !== null ? `${row.percentUsed}% used` : 'No budget set'}
                    </Caption>
                  </View>
                </View>
                <Bar percent={row.plannedCents > 0 ? Math.min(100, percent) : 0} color={barColor} />
                {isOver ? (
                  <Caption bold color="warning">
                    {row.name} is {formatCents(row.overCents)} over the amount planned for this
                    month — worth a look, no rush.
                  </Caption>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </DashCard>
  );
}
