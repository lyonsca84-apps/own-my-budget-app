import { View } from 'react-native';
import { formatCents, suggestedPromoPaymentCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { DetailGrid, DetailItem } from './detail-grid';
import { formatApr, longDate, ordinal, aprOrUnknown, type DebtItem } from './view-models';

export function cardStatusLabel(card: DebtItem): string {
  if (card.paidOff) return 'Paid off';
  return card.totalPaidCents > 0 ? 'Partly paid' : 'Balance outstanding';
}

export const dueDayText = (debt: DebtItem) =>
  debt.dueDay ? `${ordinal(debt.dueDay)} of each month` : null;

/** Every fact we track about a card. `compact` drops the identity rows the card face already shows. */
export function CardFullDetails({
  card,
  compact,
  onEdit,
  maxColumns = 3,
}: {
  card: DebtItem;
  compact?: boolean;
  onEdit: () => void;
  maxColumns?: number;
}) {
  const promoSuggestion = suggestedPromoPaymentCents(card.promoBalanceCents, card.promoExpiresOn);
  return (
    <View style={{ gap: Space[3] }}>
      <DetailGrid maxColumns={maxColumns} minCell={compact ? 120 : 170}>
        {!compact ? <DetailItem label="Bank or issuer" value={card.issuer} onAdd={onEdit} /> : null}
        {!compact ? (
          <DetailItem
            label="Card number"
            value={card.last4 ? `•••• ${card.last4}` : null}
            onAdd={onEdit}
          />
        ) : null}
        {!compact ? (
          <DetailItem
            label="Card network"
            value={card.network && card.network !== 'Not specified' ? card.network : null}
            onAdd={onEdit}
          />
        ) : null}
        {!compact ? (
          <DetailItem label="Original balance" value={formatCents(card.startingBalanceCents)} />
        ) : null}
        <DetailItem
          label="APR"
          value={aprOrUnknown(card.aprBasisPoints, 'Unknown')}
          onAdd={onEdit}
        />
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
        <DetailItem label="Payment status" value={cardStatusLabel(card)} />
      </DetailGrid>
      {promoSuggestion !== null ? (
        <ThemedText type="smallBold" themeColor="solidAccent">
          Suggested payment to clear promo in time: {formatCents(promoSuggestion)} a month
        </ThemedText>
      ) : null}
      <DetailItem label="Notes" value={card.notes} onAdd={onEdit} />
    </View>
  );
}
