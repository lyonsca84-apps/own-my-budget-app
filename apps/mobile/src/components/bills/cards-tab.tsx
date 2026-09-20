import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  calculatePayoffGoalPercent,
  formatCents,
  suggestedPromoPaymentCents,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { TextField } from '@/components/ui/text-field';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CardCarousel } from './card-carousel';
import {
  ConfirmRemove,
  DangerButton,
  PaidOffChip,
  LabelText,
  PlanLine,
  formatDollarsInput,
  parseDollarsToCents,
  useSyncedText,
} from './common';
import { DetailGrid, DetailItem, SummaryTile, SummaryTiles } from './detail-grid';
import type { PayoffPrefs, PlanSummary } from './use-bills-debt-data';
import { formatApr, longDate, ordinal, type DebtItem } from './view-models';

export interface CardsTabProps {
  cards: DebtItem[];
  plans: Record<string, PlanSummary>;
  prefs: PayoffPrefs;
  isLoading: boolean;
  onAddCard: () => void;
  onEditCard: (card: DebtItem) => void;
  onManagePayments: (card: DebtItem) => void;
  onPlanPayment: (card: DebtItem) => void;
  onRemoveCard: (card: DebtItem) => Promise<void>;
  onSavePrefs: (changes: Partial<PayoffPrefs>) => Promise<void>;
  onExportCsv: () => Promise<void>;
}

function statusLabel(card: DebtItem): string {
  if (card.paidOff) return 'Paid off';
  return card.totalPaidCents > 0 ? 'Partly paid' : 'Balance outstanding';
}

const dueText = (card: DebtItem) => (card.dueDay ? `${ordinal(card.dueDay)} of each month` : null);
const aprText = (card: DebtItem) => formatApr(card.aprBasisPoints);

export function CardsTab(props: CardsTabProps) {
  const { cards, plans, prefs, isLoading, onAddCard } = props;
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
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
      {/* ---- Carousel (or its empty state) ---- */}
      <View
        style={{
          backgroundColor: theme.backgroundSelected,
          borderRadius: Radius.hero,
          paddingVertical: Space[5],
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
      </View>

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
            <LabelText>{selected.label}</LabelText>
            <ThemedText type="smallBold" themeColor="primary">
              {statusLabel(selected)}
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
                  ? `${Math.round(selected.utilizationPercent)}%`
                  : null
              }
              onAdd={() => props.onEditCard(selected)}
            />
            <DetailItem label="Minimum payment" value={formatCents(selected.minimumPaymentCents)} />
            <DetailItem label="Amount due" value={formatCents(selected.minimumPaymentCents)} />
            <DetailItem
              label="Due date"
              value={dueText(selected)}
              onAdd={() => props.onEditCard(selected)}
            />
            <DetailItem label="Paid this month" value={formatCents(selected.paidThisMonthCents)} />
          </DetailGrid>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button
              label="Manage payments"
              variant="panel"
              onPress={() => props.onManagePayments(selected)}
            />
            <Button
              label={showDetails ? 'Hide details' : 'View details'}
              variant="secondary"
              accessibilityState={{ expanded: showDetails }}
              onPress={() => setShowDetails((v) => !v)}
            />
            <Button
              label="Edit card"
              variant="secondary"
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
          {showDetails ? (
            <CardFullDetails card={selected} onEdit={() => props.onEditCard(selected)} />
          ) : null}
        </Card>
      ) : null}

      {/* ---- Summary tiles ---- */}
      <SummaryTiles>
        <SummaryTile
          label="Total starting debt"
          value={formatCents(totals.startingCents)}
          tone="panel"
        />
        <SummaryTile
          label="Total current debt"
          value={formatCents(totals.currentCents)}
          tone="primary"
        />
        <SummaryTile label="Total paid" value={formatCents(totals.paidCents)} tone="success" />
        <SummaryTile label="Total min. payments" value={formatCents(totals.minimumCents)} />
        <SummaryTile label="Est. monthly interest" value={formatCents(totals.interestCents)} />
        <SummaryTile
          label="Overall utilization"
          value={totals.utilization !== null ? `${totals.utilization}%` : '—'}
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
          <Button label="+ Add credit card" onPress={onAddCard} />
        </View>
      ) : null}

      {/* ---- Every card, collapsible ---- */}
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[4], alignItems: 'flex-start' }}
      >
        {cards.map((card) => {
          const open = !!expanded[card.id];
          const plan = plans[`debt:${card.id}`];
          const utilPercent = card.utilizationPercent;
          return (
            <Card key={card.id} style={{ flexGrow: 1, flexBasis: 300, gap: Space[3], minWidth: 0 }}>
              <View style={{ gap: Space[1] }}>
                <LabelText>{card.label}</LabelText>
                {card.paidOff ? <PaidOffChip /> : null}
              </View>
              <ThemedText type="amount">{formatCents(card.balanceCents)}</ThemedText>
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
                    ? `${formatCents(card.balanceCents)} of ${formatCents(card.creditLimitCents)} limit`
                    : 'Credit limit not set'}
                </ThemedText>
                {card.creditLimitCents === null ? (
                  <Button
                    label="Add"
                    variant="quiet"
                    onPress={() => props.onEditCard(card)}
                    accessibilityLabel={`Add a credit limit for ${card.label}`}
                  />
                ) : null}
              </View>
              <ProgressBar
                percent={utilPercent ?? 0}
                tone={utilPercent !== null && utilPercent >= 50 ? 'watch' : 'success'}
              />
              <ThemedText type="smallBold" themeColor="textSecondary">
                {utilPercent !== null
                  ? `Utilization: ${Math.round(utilPercent)}%${utilPercent >= 50 ? ' · worth watching' : ''}`
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
                  <ThemedText type="smallBold">{formatCents(card.minimumPaymentCents)}</ThemedText>
                  {' · Due '}
                  {dueText(card) ?? '—'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Planned payment:{' '}
                  <ThemedText type="smallBold">
                    {card.plannedPaymentCents !== null
                      ? formatCents(card.plannedPaymentCents)
                      : '—'}
                  </ThemedText>
                </ThemedText>
                <PlanLine plan={plan} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                <Button
                  label="Manage payments"
                  variant="panel"
                  onPress={() => props.onManagePayments(card)}
                />
                <Button
                  label="Plan payment"
                  variant="secondary"
                  onPress={() => props.onPlanPayment(card)}
                />
                <Button
                  label={open ? 'Less details ▴' : 'More details ▾'}
                  variant="secondary"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setExpanded((prev) => ({ ...prev, [card.id]: !open }))}
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
                  <CardFullDetails card={card} compact onEdit={() => props.onEditCard(card)} />
                  <PlanLine plan={plan} label="Paycheck plan" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                    <Button
                      label="Edit"
                      variant="secondary"
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
      </View>
    </View>
  );
}

/** Every fact we track about a card. `compact` drops the identity rows the carousel face already shows. */
function CardFullDetails({
  card,
  compact,
  onEdit,
}: {
  card: DebtItem;
  compact?: boolean;
  onEdit: () => void;
}) {
  const promoSuggestion = suggestedPromoPaymentCents(card.promoBalanceCents, card.promoExpiresOn);
  return (
    <View style={{ gap: Space[3] }}>
      <DetailGrid>
        {!compact ? (
          <>
            <DetailItem label="Bank or issuer" value={card.issuer} onAdd={onEdit} />
            <DetailItem
              label="Card number"
              value={card.last4 ? `•••• ${card.last4}` : null}
              onAdd={onEdit}
            />
            <DetailItem
              label="Card network"
              value={card.network && card.network !== 'Not specified' ? card.network : null}
              onAdd={onEdit}
            />
            <DetailItem label="Original balance" value={formatCents(card.startingBalanceCents)} />
          </>
        ) : null}
        <DetailItem label="APR" value={aprText(card)} />
        <DetailItem
          label="Available credit"
          value={
            card.creditLimitCents !== null
              ? formatCents(Math.max(0, card.creditLimitCents - card.balanceCents))
              : null
          }
          onAdd={onEdit}
        />
        <DetailItem
          label="Est. interest / month"
          value={formatCents(card.estMonthlyInterestCents)}
        />
        <DetailItem label="Total paid" value={formatCents(card.totalPaidCents)} />
        <DetailItem
          label="Promo balance"
          value={card.promoBalanceCents !== null ? formatCents(card.promoBalanceCents) : null}
          onAdd={onEdit}
        />
        <DetailItem
          label="Promo APR"
          value={card.promoAprBasisPoints !== null ? formatApr(card.promoAprBasisPoints) : null}
          onAdd={onEdit}
        />
        <DetailItem
          label="Promo expires"
          value={card.promoExpiresOn ? longDate(card.promoExpiresOn) : null}
          onAdd={onEdit}
        />
        <DetailItem
          label="Paid-down progress"
          value={card.paidPercent !== null ? `${card.paidPercent}%` : null}
        />
        <DetailItem label="Payment status" value={statusLabel(card)} />
      </DetailGrid>
      {promoSuggestion !== null ? (
        <ThemedText type="smallBold" themeColor="primary">
          Suggested payment to clear promo in time: {formatCents(promoSuggestion)} a month
        </ThemedText>
      ) : null}
      <DetailItem label="Notes" value={card.notes} onAdd={onEdit} />
    </View>
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
  const [date, setDate] = useSyncedText(prefs.goalTargetDate ?? '');
  const [monthly, setMonthly] = useSyncedText(formatDollarsInput(prefs.goalMonthlyCents));
  const [dateError, setDateError] = useState<string | null>(null);

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
        <LabelText>Payoff goal</LabelText>
        <Button
          label="Export cards to CSV"
          variant="secondary"
          disabled={!hasCards}
          onPress={onExport}
        />
      </View>
      {exportMessage ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {exportMessage}
        </ThemedText>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
        <View style={{ flexGrow: 1, flexBasis: 160 }}>
          <TextField
            label="Target debt ($)"
            value={target}
            onChangeText={setTarget}
            placeholder="0.00"
            keyboardType="decimal-pad"
            onBlur={() => onSavePrefs({ goalTargetCents: parseDollarsToCents(target) })}
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 160 }}>
          <TextField
            label="Target payoff date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            errorMessage={dateError ?? undefined}
            onBlur={() => {
              const trimmed = date.trim();
              if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                setDateError('Use the format YYYY-MM-DD.');
                return;
              }
              setDateError(null);
              onSavePrefs({ goalTargetDate: trimmed || null });
            }}
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 160 }}>
          <TextField
            label="Monthly payment goal ($)"
            value={monthly}
            onChangeText={setMonthly}
            placeholder="0.00"
            keyboardType="decimal-pad"
            onBlur={() => onSavePrefs({ goalMonthlyCents: parseDollarsToCents(monthly) })}
          />
        </View>
      </View>
      <View style={{ gap: Space[1] }}>
        <ProgressBar percent={percent} tone="success" />
        <ThemedText type="smallBold" themeColor="textSecondary">
          {targetCents === null
            ? 'Set a target debt to track your progress.'
            : `${percent}% toward goal`}
        </ThemedText>
      </View>
    </Card>
  );
}
