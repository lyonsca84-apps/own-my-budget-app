import {
  CHART_RANGES,
  formatCents,
  type CashFlow,
  type ChartBar,
  type ChartRangeKey,
} from '@own-my-budget/core';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Caption, DashCard } from '@/components/dashboard/common';
import { MONTH_SHORT } from '@/components/dashboard/format';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CashFlowCardProps {
  periodLabel: string;
  cashFlow: CashFlow;
  chartBars: (range: ChartRangeKey) => ChartBar[];
}

const FIGURES: { key: string; label: string }[] = [
  { key: 'income', label: 'Total monthly income' },
  { key: 'bills', label: 'Total bills' },
  { key: 'debt', label: 'Total debt payments' },
  { key: 'variable', label: 'Total variable spending' },
  { key: 'savings', label: 'Total savings' },
  { key: 'available', label: 'Remaining available money' },
];

const CHART_HEIGHT = 130;

/** Six month figures, the stacked "where your income goes" bar, and the income-vs-spending chart with range tabs. */
export function CashFlowCard({ periodLabel, cashFlow, chartBars }: CashFlowCardProps) {
  const theme = useTheme();
  const [range, setRange] = useState<ChartRangeKey>('quarter');
  const bars = useMemo(() => chartBars(range), [chartBars, range]);

  const values: Record<string, number> = {
    income: cashFlow.incomeCents,
    bills: cashFlow.billsCents,
    debt: cashFlow.debtCents,
    variable: cashFlow.variableCents,
    savings: cashFlow.savingsCents,
    available: cashFlow.availableCents,
  };
  const segmentColor: Record<string, string> = {
    bills: theme.panel,
    debt: theme.primary,
    variable: theme.accent,
    savings: theme.successSolid,
    available: theme.energy,
  };
  const barSummary = cashFlow.segments
    .map((s) => `${s.label} ${formatCents(s.cents)}, ${Math.round(s.percent)} percent`)
    .join('; ');
  const hasAnyBar = cashFlow.segments.some((s) => s.cents > 0);

  return (
    <DashCard title="Monthly Cash Flow" action={<Caption bold>{periodLabel}</Caption>}>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: Space[3], columnGap: Space[4] }}
      >
        {FIGURES.map((figure) => {
          const cents = values[figure.key];
          const isNegative = cents < 0;
          return (
            <View key={figure.key} style={{ flexBasis: '46%', flexGrow: 1, minWidth: 140, gap: 2 }}>
              <Caption style={{ fontSize: 13, lineHeight: 18 }}>{figure.label}</Caption>
              <ThemedText
                themeColor={isNegative ? 'warning' : 'text'}
                style={{
                  fontFamily: Fonts.heading.semibold,
                  fontSize: 18,
                  lineHeight: 26,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatCents(cents)}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`How this month's income is distributed. ${barSummary}`}
        style={{
          flexDirection: 'row',
          height: 14,
          borderRadius: Radius.chip,
          overflow: 'hidden',
          backgroundColor: theme.backgroundSelected,
        }}
      >
        {hasAnyBar
          ? cashFlow.segments
              .filter((s) => s.cents > 0)
              .map((s) => (
                <View
                  key={s.key}
                  style={{
                    flexGrow: s.percent,
                    flexBasis: 0,
                    backgroundColor: segmentColor[s.key],
                  }}
                />
              ))
          : null}
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: Space[4], rowGap: Space[2] }}
      >
        {cashFlow.segments.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              accessibilityElementsHidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: segmentColor[s.key],
              }}
            />
            <ThemedText style={{ fontFamily: Fonts.body.semibold, fontSize: 13, lineHeight: 18 }}>
              {s.label}
            </ThemedText>
            <Caption style={{ fontSize: 13, lineHeight: 18 }}>
              {formatCents(s.cents)} · {Math.round(s.percent)}%
            </Caption>
          </View>
        ))}
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingTop: Space[4],
          gap: Space[4],
        }}
      >
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}
        >
          {CHART_RANGES.map((option) => {
            const selected = option.key === range;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                aria-selected={selected}
                accessibilityLabel={option.label}
                onPress={() => setRange(option.key)}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: Space[3],
                  borderRadius: Radius.chip,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.panel : theme.controlBorder,
                  backgroundColor: selected ? theme.panel : theme.backgroundElement,
                }}
              >
                <ThemedText
                  style={{
                    color: selected ? theme.onPanel : theme.text,
                    fontFamily: Fonts.body.semibold,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Space[3],
            height: CHART_HEIGHT + 24,
          }}
        >
          {bars.map((bar) => (
            <View
              key={`${bar.year}-${bar.month}`}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 6,
                justifyContent: 'flex-end',
                height: '100%',
              }}
            >
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${MONTH_SHORT[bar.month]} ${bar.year}: income ${formatCents(bar.incomeCents)}, spending ${formatCents(bar.spendCents)}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 4,
                  width: '100%',
                  height: CHART_HEIGHT,
                }}
              >
                <View
                  style={{
                    width: '30%',
                    maxWidth: 30,
                    height: `${bar.incomePercent}%`,
                    minHeight: bar.incomeCents > 0 ? 3 : 0,
                    backgroundColor: theme.primary,
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                  }}
                />
                <View
                  style={{
                    width: '30%',
                    maxWidth: 30,
                    height: `${bar.spendPercent}%`,
                    minHeight: bar.spendCents > 0 ? 3 : 0,
                    backgroundColor: theme.accent,
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                  }}
                />
              </View>
              <Caption bold style={{ fontSize: 13, lineHeight: 18 }}>
                {MONTH_SHORT[bar.month]}
              </Caption>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: Space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: theme.primary }}
            />
            <Caption bold style={{ fontSize: 13, lineHeight: 18 }}>
              Income
            </Caption>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: theme.accent }}
            />
            <Caption bold style={{ fontSize: 13, lineHeight: 18 }}>
              Spending
            </Caption>
          </View>
        </View>
      </View>
    </DashCard>
  );
}
