import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  calculatePayoffComparison,
  calculatePayoffSchedule,
  formatCents,
  orderDebtsForStrategy,
  parseLocalDate,
  type DebtInput,
  type PayoffScheduleResult,
  type PayoffStrategy,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  ResponsiveGrid,
  formatDollarsInput,
  formatWholeDollars,
  parseDollarsToCents,
  useSyncedText,
} from './common';
import type { PayoffPrefs } from './use-bills-debt-data';
import { aprOrUnknown, type DebtItem } from './view-models';

export interface PayoffTabProps {
  cards: DebtItem[];
  loans: DebtItem[];
  prefs: PayoffPrefs;
  canUseAvalanche: boolean;
  isLoading: boolean;
  onSavePrefs: (changes: Partial<PayoffPrefs>) => Promise<void>;
  onSeePlans: () => void;
}

const HEADING = { fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 } as const;

const STRATEGY_OPTIONS: { value: PayoffStrategy; label: string }[] = [
  { value: 'snowball', label: 'Snowball' },
  { value: 'avalanche', label: 'Avalanche ★' },
];

const EXPLAINER: Record<PayoffStrategy, string> = {
  snowball: 'Smallest balance first — quick wins to build momentum.',
  avalanche: 'Highest interest rate first — saves the most money over time.',
};

function monthsText(result: PayoffScheduleResult): string {
  if (!result.completed) return 'Ongoing — increase payment';
  return result.months === 0 ? 'Already paid off' : `${result.months} months`;
}

function monthYear(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function PayoffTab({
  cards,
  loans,
  prefs,
  canUseAvalanche,
  isLoading,
  onSavePrefs,
  onSeePlans,
}: PayoffTabProps) {
  const theme = useTheme();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [extraText, setExtraText] = useSyncedText(
    formatDollarsInput(prefs.extraMonthlyCents || null)
  );

  // A saved "avalanche" from a since-lapsed plan quietly falls back to snowball.
  const strategy: PayoffStrategy =
    prefs.strategy === 'avalanche' && canUseAvalanche ? 'avalanche' : 'snowball';
  const extraCents = parseDollarsToCents(extraText) ?? 0;

  const debts = useMemo(
    () => [...cards, ...loans].filter((d) => d.balanceCents > 0),
    [cards, loans]
  );
  const inputs: DebtInput[] = useMemo(
    () =>
      debts.map((d) => ({
        id: d.id,
        balanceCents: d.balanceCents,
        aprBasisPoints: d.aprBasisPoints,
        minimumPaymentCents: d.minimumPaymentCents,
      })),
    [debts]
  );
  const byId = useMemo(() => new Map(debts.map((d) => [d.id, d])), [debts]);

  const ordered = useMemo(() => orderDebtsForStrategy(inputs, strategy), [inputs, strategy]);
  const comparison = useMemo(
    () => calculatePayoffComparison(inputs, extraCents, strategy),
    [inputs, extraCents, strategy]
  );
  const versus = useMemo(
    () =>
      canUseAvalanche && inputs.length > 0
        ? {
            snowball: calculatePayoffSchedule(inputs, extraCents, 'snowball'),
            avalanche: calculatePayoffSchedule(inputs, extraCents, 'avalanche'),
          }
        : null,
    [canUseAvalanche, inputs, extraCents]
  );

  if (debts.length === 0) {
    return (
      <EmptyState
        title={isLoading ? 'Loading your debts…' : 'No debt to plan yet'}
        message={
          isLoading
            ? 'One moment while we gather your accounts.'
            : 'Add a credit card or loan and your snowball and avalanche payoff plans will appear here.'
        }
        mascot={!isLoading}
      />
    );
  }

  function choose(next: PayoffStrategy) {
    if (next === 'avalanche' && !canUseAvalanche) {
      setShowUpgrade(true);
      return;
    }
    setShowUpgrade(false);
    onSavePrefs({ strategy: next });
  }

  return (
    <View style={{ gap: Space[4] }}>
      <Card style={{ gap: Space[4] }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: Space[3],
          }}
        >
          <ThemedText accessibilityRole="header" style={HEADING}>
            Debt payoff plan
          </ThemedText>
          <SegmentedControl
            variant="soft"
            size="sm"
            accessibilityLabel="Payoff strategy"
            options={STRATEGY_OPTIONS}
            // Free accounts see Snowball selected; tapping Avalanche shows the upgrade card instead.
            value={strategy}
            onChange={choose}
          />
        </View>

        {showUpgrade && !canUseAvalanche ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              gap: Space[3],
              padding: Space[4],
              borderRadius: Radius.smallCard,
              backgroundColor: theme.primaryMuted,
            }}
          >
            <ThemedText type="smallBold">The avalanche optimizer is a Premium feature</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Snowball stays free. Upgrade to order your debts by interest rate and compare both
              strategies side by side.
            </ThemedText>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button label="See plans" size="sm" shape="rounded" onPress={onSeePlans} />
            </View>
          </View>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary">
          {EXPLAINER[strategy]}
        </ThemedText>

        <View style={{ gap: Space[2] }}>
          {ordered.map((entry, index) => {
            const debt = byId.get(entry.id);
            if (!debt) return null;
            return (
              <View
                key={entry.id}
                accessible
                accessibilityLabel={`Number ${index + 1}: ${debt.label}, APR ${aprOrUnknown(
                  debt.aprBasisPoints,
                  'unknown'
                )}, balance ${formatCents(debt.balanceCents)}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Space[3],
                  paddingVertical: Space[3],
                  paddingHorizontal: Space[4],
                  borderRadius: Radius.smallCard,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: theme.accentMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ThemedText type="smallBold" themeColor="solidAccent">
                    {index + 1}
                  </ThemedText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText style={{ fontFamily: Fonts.body.semibold }}>{debt.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    APR {aprOrUnknown(debt.aprBasisPoints, 'Unknown')}
                  </ThemedText>
                </View>
                <ThemedText type="amountSmall">{formatWholeDollars(debt.balanceCents)}</ThemedText>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: Space[4] }}>
        <ThemedText accessibilityRole="header" style={HEADING}>
          Payoff calculator
        </ThemedText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3] }}
        >
          <ThemedText themeColor="textSecondary">Extra amount per month</ThemedText>
          <View style={{ width: 160 }}>
            <TextField
              label="Extra amount per month"
              hideLabel
              value={extraText}
              onChangeText={setExtraText}
              placeholder="0"
              keyboardType="decimal-pad"
              onBlur={() => onSavePrefs({ extraMonthlyCents: extraCents })}
            />
          </View>
        </View>
        <ResponsiveGrid minCell={200} maxColumns={4} gap={Space[3]}>
          <ResultTile label="Minimum payments only" value={monthsText(comparison.minimumOnly)} />
          <ResultTile
            label="With extra payment"
            value={monthsText(comparison.withExtra)}
            highlight
          />
          <ResultTile
            label="Time saved"
            value={comparison.monthsSaved !== null ? `${comparison.monthsSaved} months` : '—'}
          />
          <ResultTile
            label="Est. interest saved"
            value={
              comparison.interestSavedCents !== null
                ? formatCents(comparison.interestSavedCents)
                : '—'
            }
          />
        </ResponsiveGrid>
        {!comparison.minimumOnly.completed ? (
          <ThemedText type="small" themeColor="textSecondary">
            At the minimum payments alone, interest keeps pace with what you pay. Adding an extra
            amount each month is what moves the balance down.
          </ThemedText>
        ) : null}
      </Card>

      {versus ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText accessibilityRole="header" style={HEADING}>
            Snowball vs. avalanche
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
            {(['snowball', 'avalanche'] as const).map((name) => {
              const result = versus[name];
              return (
                <View
                  key={name}
                  style={{
                    flexGrow: 1,
                    flexBasis: 200,
                    gap: 2,
                    padding: Space[4],
                    borderRadius: Radius.smallCard,
                    backgroundColor: theme.backgroundSelected,
                  }}
                >
                  <ThemedText type="smallBold">
                    {name === 'snowball' ? 'Snowball' : 'Avalanche'}
                  </ThemedText>
                  <ThemedText type="small">{monthsText(result)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCents(result.totalInterestCents)} interest
                  </ThemedText>
                  {result.completed ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Debt-free {monthYear(result.payoffDate)}
                    </ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

/** A calculator result: soft gray tile, the "with extra" one in the teal highlight. */
function ResultTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        gap: Space[1],
        padding: Space[4],
        borderRadius: Radius.smallCard,
        backgroundColor: highlight ? theme.accentMuted : theme.backgroundSelected,
      }}
    >
      <ThemedText type="smallBold" style={{ fontFamily: Fonts.body.medium }}>
        {label}
      </ThemedText>
      <ThemedText
        style={{
          fontFamily: Fonts.heading.bold,
          fontSize: 22,
          lineHeight: 28,
          letterSpacing: -0.22,
        }}
      >
        {value}
      </ThemedText>
    </View>
  );
}
