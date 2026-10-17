import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { calculatePayoffGoalPercent, formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chevron } from '@/components/ui/chevron';
import { DateField } from '@/components/ui/date-field';
import { ProgressBar } from '@/components/ui/progress-bar';
import { TextField } from '@/components/ui/text-field';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CardCarousel } from './card-carousel';
import { CardFullDetails, cardStatusLabel, dueDayText } from './card-details';
import {
  ConfirmRemove,
  DangerButton,
  PaidOffChip,
  PlanLine,
  ResponsiveGrid,
  formatDollarsInput,
  formatWholeDollars,
  parseDollarsToCents,
  useSyncedText,
} from './common';
import { DetailGrid, DetailItem, SummaryTile, SummaryTiles } from './detail-grid';
import type { PayoffPrefs, PlanSummary } from './use-bills-debt-data';
import type { DebtItem } from './view-models';

export interface CardsTabProps {
  cards: DebtItem[];
  plans: Record<string, PlanSummary>;
  prefs: PayoffPrefs;
  isLoading: boolean;
  onAddCard: () => void;
  onEditCard: (card: DebtItem) => void;
  onViewDetails: (card: DebtItem) => void;
  onManagePayments: (card: DebtItem) => void;
  onPlanPayment: (card: DebtItem) => void;
  onRemoveCard: (card: DebtItem) => Promise<void>;
  onSavePrefs: (changes: Partial<PayoffPrefs>) => Promise<void>;
  onExportCsv: () => Promise<void>;
}

/** Utilization at or above this reads as "worth watching" (calm amber, with words). */
const WATCH_UTILIZATION = 50;

export function CardsTab(props: CardsTabProps) {
  const { cards, plans, prefs, isLoading, onAddCard } = props;
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // The selection is derived, so a removed/reloaded card can never leave it dangling.
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;

  const totals = useMemo(() => {
    const withLimit = cards.filter((c) => c.creditLimitCents && c.creditLimitCents > 0);
    const limitSum = withLimit.reduce((sum, c) => sum + (c.creditLimitCents ?? 0), 0);
    const limitedBalance = withLimit.reduce((sum, c) => sum + c.balanceCents, 0);
    return {
      startingCents: cards.reduce((sum, c) => sum + c.startingBalanceCents, 0),
      currentCents: cards.reduce((sum, c) => sum + c.balanceCents, 0),
      paidCents: cards.reduce((sum, c) => sum + c.totalPaidCents, 0),
      minimumCents: cards.reduce((sum, c) => sum + c.minimumPaymentCents, 0),
      interestCents: cards.reduce((sum, c) => sum + c.estMonthlyInterestCents, 0),
      utilization: limitSum > 0 ? Math.round((limitedBalance / limitSum) * 100) : null,
      paidOffCount: cards.filter((c) => c.paidOff).length,
    };
  }, [cards]);

  async function handleExport() {
    setExportMessage(null);
    try {
      await props.onExportCsv();
      setExportMessage('Exported your cards to CSV.');
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "We couldn't export your cards.");
    }
  }

  return (
    <View style={{ gap: Space[5] }}>
      {/* ---- Carousel hero (or its empty state) ---- */}
      <LinearGradient
        colors={[theme.primaryMuted, theme.accentMuted, theme.backgroundSelected]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: Radius.hero,
          paddingVertical: Space[7],
          overflow: 'hidden',
        }}
      >
        {cards.length === 0 ? (
          <View style={{ alignItems: 'center', gap: Space[3], padding: Space[5] }}>
            <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
              {isLoading ? 'Loading your cards…' : 'No credit cards yet'}
            </ThemedText>
            {!isLoading ? (
              <>
                <View style={{ maxWidth: 360 }}>
                  <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                    Add your first credit card to begin tracking your balance and payments.
                  </ThemedText>
                </View>
                <Button label="+ Add credit card" onPress={onAddCard} />
              </>
            ) : null}
          </View>
        ) : (
          <CardCarousel cards={cards} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        )}
      </LinearGradient>

      {/* ---- Selected card ---- */}
      {selected ? (
        <Card style={{ gap: Space[4] }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: Space[2],
            }}
          >
            <ThemedText
              style={{ fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 }}
            >
              {selected.label}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="solidAccent">
              {cardStatusLabel(selected)}
            </ThemedText>
          </View>
          <DetailGrid>
            <DetailItem label="Current balance" value={formatCents(selected.balanceCents)} />
            <DetailItem
              label="Available credit"
              value={
                selected.creditLimitCents !== null
                  ? formatCents(Math.max(0, selected.creditLimitCents - selected.balanceCents))
                  : null
              }
              onAdd={() => props.onEditCard(selected)}
            />
            <DetailItem
              label="Credit limit"
              value={
                selected.creditLimitCents !== null ? formatCents(selected.creditLimitCents) : null
              }
              onAdd={() => props.onEditCard(selected)}
            />
            <DetailItem
              label="Utilization"
              value={
                selected.utilizationPercent !== null
                  ? `${Math.round(selected.utilizationPercent)}%${
                      selected.utilizationPercent >= WATCH_UTILIZATION ? ' · worth watching' : ''
                    }`
                  : null
              }
              tone={
                selected.utilizationPercent !== null &&
                selected.utilizationPercent >= WATCH_UTILIZATION
                  ? 'watch'
                  : 'default'
              }
              onAdd={() => props.onEditCard(selected)}
            />
            <DetailItem label="Minimum payment" value={formatCents(selected.minimumPaymentCents)} />
            <DetailItem label="Amount due" value={formatCents(selected.minimumPaymentCents)} />
            <DetailItem
              label="Due date"
              value={dueDayText(selected)}
              onAdd={() => props.onEditCard(selected)}
            />
            <DetailItem
              label="Amount paid this month"
              value={formatCents(selected.paidThisMonthCents)}
            />
          </DetailGrid>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button
              label="Manage payments"
              variant="panel"
              size="sm"
              shape="rounded"
              onPress={() => props.onManagePayments(selected)}
            />
            <Button
              label="View details"
              variant="outline"
              size="sm"
              shape="rounded"
              onPress={() => props.onViewDetails(selected)}
            />
            <Button
              label="Edit card"
              variant="outline"
              size="sm"
              shape="rounded"
              onPress={() => props.onEditCard(selected)}
            />
            <DangerButton label="Delete card" onPress={() => setPendingRemoveId(selected.id)} />
          </View>
          {pendingRemoveId === selected.id ? (
            <ConfirmRemove
              name={selected.label}
              noun="card"
              onCancel={() => setPendingRemoveId(null)}
              onConfirm={async () => {
                setPendingRemoveId(null);
                await props.onRemoveCard(selected);
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {/* ---- Summary tiles ---- */}
      <SummaryTiles>
        <SummaryTile
          label="Total starting debt"
          value={formatWholeDollars(totals.startingCents)}
          tone="panel"
        />
        <SummaryTile
          label="Total current debt"
          value={formatWholeDollars(totals.currentCents)}
          tone="primary"
        />
        <SummaryTile
          label="Total paid"
          value={formatWholeDollars(totals.paidCents)}
          tone="success"
        />
        <SummaryTile label="Total min. payments" value={formatWholeDollars(totals.minimumCents)} />
        <SummaryTile
          label="Est. monthly interest"
          value={formatWholeDollars(totals.interestCents)}
        />
        <SummaryTile
          label="Overall utilization"
          value={totals.utilization !== null ? `${totals.utilization}%` : 'Add information'}
          tone="accent"
        />
        <SummaryTile label="Number of cards" value={String(cards.length)} />
        <SummaryTile label="Cards paid off" value={String(totals.paidOffCount)} />
      </SummaryTiles>

      {/* ---- Payoff goal ---- */}
      <PayoffGoalCard
        startingCents={totals.startingCents}
        currentCents={totals.currentCents}
        prefs={prefs}
        hasCards={cards.length > 0}
        onSavePrefs={props.onSavePrefs}
        onExport={handleExport}
        exportMessage={exportMessage}
      />

      {cards.length > 0 ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Button label="+ Add credit card" size="sm" shape="rounded" onPress={onAddCard} />
        </View>
      ) : null}

      {/* ---- Every card ---- */}
      <ResponsiveGrid minCell={300} maxColumns={3} gap={Space[4]} align="flex-start">
        {cards.map((card) => {
          const open = !!expanded[card.id];
          const toggle = () => setExpanded((prev) => ({ ...prev, [card.id]: !open }));
          const plan = plans[`debt:${card.id}`];
          const util = card.utilizationPercent;
          const watching = util !== null && util >= WATCH_UTILIZATION;
          return (
            <Card key={card.id} style={{ gap: Space[3], padding: Space[5], minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Space[2] }}>
                <View style={{ flex: 1, gap: Space[1], minWidth: 0 }}>
                  <ThemedText
                    style={{ fontFamily: Fonts.heading.semibold, fontSize: 16, lineHeight: 22 }}
                  >
                    {card.label}
                  </ThemedText>
                  {card.paidOff ? <PaidOffChip /> : null}
                </View>
                <ExpandButton open={open} onPress={toggle} label={card.label} />
              </View>
              <ThemedText
                style={{
                  fontFamily: Fonts.heading.bold,
                  fontSize: 28,
                  lineHeight: 34,
                  letterSpacing: -0.28,
                }}
              >
                {formatWholeDollars(card.balanceCents)}
              </ThemedText>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Space[2],
                  flexWrap: 'wrap',
                }}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  {card.creditLimitCents !== null
                    ? `of ${formatCents(card.creditLimitCents)} limit`
                    : 'Credit limit not set'}
                </ThemedText>
                {card.creditLimitCents === null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add a credit limit for ${card.label}`}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    onPress={() => props.onEditCard(card)}
                  >
                    <ThemedText type="smallBold" themeColor="solidAccent">
                      Add
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
              <ProgressBar percent={util ?? 0} tone={watching ? 'watch' : 'success'} />
              <ThemedText type="small" themeColor={watching ? 'warning' : 'textSecondary'}>
                {util !== null
                  ? `Utilization: ${Math.round(util)}%${watching ? ' · worth watching' : ''}`
                  : 'Utilization: —'}
              </ThemedText>

              <View
                style={{
                  gap: Space[1],
                  paddingTop: Space[3],
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                }}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  Minimum payment:{' '}
                  <ThemedText type="smallBold">
                    {formatWholeDollars(card.minimumPaymentCents)}
                  </ThemedText>
                  {' · Due '}
                  {dueDayText(card) ?? '—'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Planned payment:{' '}
                  <ThemedText type="smallBold">
                    {card.plannedPaymentCents !== null
                      ? formatWholeDollars(card.plannedPaymentCents)
                      : '—'}
                  </ThemedText>
                </ThemedText>
                <PlanLine plan={plan} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                <Button
                  label="Manage payments"
                  variant="panel"
                  size="sm"
                  shape="rounded"
                  accessibilityLabel={`Manage payments for ${card.label}`}
                  onPress={() => props.onManagePayments(card)}
                />
                <Button
                  label="Plan payment"
                  variant="soft"
                  size="sm"
                  shape="rounded"
                  accessibilityLabel={`Plan payment for ${card.label}`}
                  onPress={() => props.onPlanPayment(card)}
                />
                <Button
                  label={open ? 'Less details' : 'More details'}
                  variant="outline"
                  size="sm"
                  shape="rounded"
                  aria-expanded={open}
                  accessibilityLabel={`${open ? 'Less' : 'More'} details for ${card.label}`}
                  onPress={toggle}
                />
              </View>

              {open ? (
                <View
                  style={{
                    gap: Space[4],
                    paddingTop: Space[3],
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <CardFullDetails
                    card={card}
                    compact
                    maxColumns={2}
                    onEdit={() => props.onEditCard(card)}
                  />
                  <PlanLine plan={plan} label="Paycheck plan" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                    <Button
                      label="Edit"
                      variant="outline"
                      size="sm"
                      shape="rounded"
                      onPress={() => props.onEditCard(card)}
                    />
                    <DangerButton label="Delete" onPress={() => setPendingRemoveId(card.id)} />
                  </View>
                  {pendingRemoveId === card.id ? (
                    <ConfirmRemove
                      name={card.label}
                      noun="card"
                      onCancel={() => setPendingRemoveId(null)}
                      onConfirm={async () => {
                        setPendingRemoveId(null);
                        await props.onRemoveCard(card);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </ResponsiveGrid>
    </View>
  );
}

/** The round chevron in a card's corner: 44px target around a 36px bordered circle. */
export function ExpandButton({
  open,
  onPress,
  label,
}: {
  open: boolean;
  onPress: () => void;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${label}`}
      aria-expanded={open}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        marginTop: -4,
        marginRight: -6,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Chevron color={theme.textSecondary} up={open} />
      </View>
    </Pressable>
  );
}

function PayoffGoalCard({
  startingCents,
  currentCents,
  prefs,
  hasCards,
  onSavePrefs,
  onExport,
  exportMessage,
}: {
  startingCents: number;
  currentCents: number;
  prefs: PayoffPrefs;
  hasCards: boolean;
  onSavePrefs: (changes: Partial<PayoffPrefs>) => Promise<void>;
  onExport: () => Promise<void>;
  exportMessage: string | null;
}) {
  const [target, setTarget] = useSyncedText(formatDollarsInput(prefs.goalTargetCents));
  const [monthly, setMonthly] = useSyncedText(formatDollarsInput(prefs.goalMonthlyCents));

  const targetCents = parseDollarsToCents(target);
  const percent =
    targetCents !== null ? calculatePayoffGoalPercent(startingCents, currentCents, targetCents) : 0;

  return (
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
        <ThemedText style={{ fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 }}>
          Payoff goal
        </ThemedText>
        <Button
          label="Export cards to CSV"
          variant="panel"
          size="sm"
          shape="rounded"
          disabled={!hasCards}
          onPress={onExport}
        />
      </View>
      {exportMessage ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {exportMessage}
        </ThemedText>
      ) : null}
      <ResponsiveGrid minCell={200} maxColumns={4} gap={Space[3]} align="flex-end">
        <TextField
          label="Target debt"
          value={target}
          onChangeText={setTarget}
          placeholder="0.00"
          keyboardType="decimal-pad"
          onBlur={() => onSavePrefs({ goalTargetCents: parseDollarsToCents(target) })}
        />
        <DateField
          label="Target payoff date"
          value={prefs.goalTargetDate ?? ''}
          onChange={(value) => onSavePrefs({ goalTargetDate: value || null })}
        />
        <TextField
          label="Monthly payment goal"
          value={monthly}
          onChangeText={setMonthly}
          placeholder="0.00"
          keyboardType="decimal-pad"
          onBlur={() => onSavePrefs({ goalMonthlyCents: parseDollarsToCents(monthly) })}
        />
        <View style={{ gap: Space[1], minHeight: 52, justifyContent: 'center' }}>
          <ProgressBar percent={percent} tone="success" />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {targetCents === null
              ? 'Set a target debt to track progress.'
              : `${percent}% toward goal`}
          </ThemedText>
        </View>
      </ResponsiveGrid>
    </Card>
  );
}
