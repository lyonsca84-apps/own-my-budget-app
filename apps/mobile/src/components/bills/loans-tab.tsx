import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { estimateInterestPaid, formatCentsCompact, monthsToPayOff } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ExpandButton } from './cards-tab';
import { ConfirmRemove, PaidOffChip, PlanLine, formatWholeDollars } from './common';
import { DetailGrid, DetailItem, SummaryTile, SummaryTiles } from './detail-grid';
import type { PlanSummary } from './use-bills-debt-data';
import {
  LOAN_FILTERS,
  LOAN_TYPE_LABELS,
  aprOrUnknown,
  loanMatchesFilter,
  longDate,
  ordinal,
  type DebtItem,
  type LoanFilter,
} from './view-models';

export interface LoansTabProps {
  loans: DebtItem[];
  plans: Record<string, PlanSummary>;
  isLoading: boolean;
  onAddLoan: () => void;
  onEditLoan: (loan: DebtItem) => void;
  onManagePayments: (loan: DebtItem) => void;
  onPlanPayment: (loan: DebtItem) => void;
  onRemoveLoan: (loan: DebtItem) => Promise<void>;
}

function termText(months: number | null): string | null {
  if (months === null) return null;
  return months % 12 === 0 && months >= 12 ? `${months / 12} years` : `${months} months`;
}

export function LoansTab(props: LoansTabProps) {
  const { loans, plans, isLoading } = props;
  const [filter, setFilter] = useState<LoanFilter>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const visible = useMemo(() => loans.filter((l) => loanMatchesFilter(l, filter)), [loans, filter]);

  const totals = useMemo(() => {
    const mortgageCents = loans
      .filter((l) => l.type === 'mortgage')
      .reduce((sum, l) => sum + l.balanceCents, 0);
    const currentCents = loans.reduce((sum, l) => sum + l.balanceCents, 0);
    return {
      originalCents: loans.reduce((sum, l) => sum + l.startingBalanceCents, 0),
      currentCents,
      paidCents: loans.reduce((sum, l) => sum + l.totalPaidCents, 0),
      monthlyCents: loans.reduce((sum, l) => sum + l.minimumPaymentCents, 0),
      interestCents: loans.reduce((sum, l) => sum + l.estMonthlyInterestCents, 0),
      mortgageCents,
      otherCents: currentCents - mortgageCents,
      active: loans.filter((l) => !l.paidOff).length,
      paidOff: loans.filter((l) => l.paidOff).length,
    };
  }, [loans]);

  return (
    <View style={{ gap: Space[5] }}>
      <SegmentedControl
        variant="chips"
        size="sm"
        accessibilityLabel="Filter accounts"
        options={LOAN_FILTERS}
        value={filter}
        onChange={setFilter}
      />

      <SummaryTiles>
        <SummaryTile
          label="Total original amount"
          value={formatWholeDollars(totals.originalCents)}
          tone="panel"
        />
        <SummaryTile
          label="Total current balance"
          value={formatWholeDollars(totals.currentCents)}
          tone="primary"
        />
        <SummaryTile
          label="Total paid"
          value={formatWholeDollars(totals.paidCents)}
          tone="success"
        />
        <SummaryTile
          label="Total monthly payments"
          value={formatWholeDollars(totals.monthlyCents)}
        />
        <SummaryTile
          label="Est. monthly interest"
          value={formatWholeDollars(totals.interestCents)}
        />
        <SummaryTile
          label="Mortgage balance"
          value={formatWholeDollars(totals.mortgageCents)}
          tone="accent"
        />
        <SummaryTile
          label="Other loan balance"
          value={formatWholeDollars(totals.otherCents)}
          tone="accent"
        />
        <SummaryTile label="Active accounts" value={String(totals.active)} />
        <SummaryTile label="Paid-off accounts" value={String(totals.paidOff)} />
      </SummaryTiles>

      <View style={{ alignItems: 'flex-end' }}>
        <Button
          label="+ Add loan or mortgage"
          size="sm"
          shape="rounded"
          onPress={props.onAddLoan}
        />
      </View>

      {loans.length === 0 ? (
        <EmptyState
          title={isLoading ? 'Loading your loans…' : 'No loans or mortgages yet'}
          message={
            isLoading
              ? 'One moment while we gather your accounts.'
              : 'Add a mortgage, HELOC, or personal loan to track what is left and when it will be paid off.'
          }
          mascot={!isLoading}
        />
      ) : visible.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">Nothing in this group yet.</ThemedText>
        </Card>
      ) : (
        <View style={{ gap: Space[3] }}>
          {visible.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              plan={plans[`debt:${loan.id}`]}
              open={!!expanded[loan.id]}
              onToggle={() => setExpanded((prev) => ({ ...prev, [loan.id]: !prev[loan.id] }))}
              confirmingRemove={pendingRemoveId === loan.id}
              onAskRemove={() => setPendingRemoveId(loan.id)}
              onCancelRemove={() => setPendingRemoveId(null)}
              onConfirmRemove={async () => {
                setPendingRemoveId(null);
                await props.onRemoveLoan(loan);
              }}
              onEdit={() => props.onEditLoan(loan)}
              onManage={() => props.onManagePayments(loan)}
              onPlan={() => props.onPlanPayment(loan)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function LoanCard({
  loan,
  plan,
  open,
  onToggle,
  confirmingRemove,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
  onEdit,
  onManage,
  onPlan,
}: {
  loan: DebtItem;
  plan?: PlanSummary;
  open: boolean;
  onToggle: () => void;
  confirmingRemove: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onEdit: () => void;
  onManage: () => void;
  onPlan: () => void;
}) {
  const theme = useTheme();
  const monthsLeft = monthsToPayOff(
    loan.balanceCents,
    loan.aprBasisPoints,
    loan.minimumPaymentCents
  );
  const split = useMemo(
    () => estimateInterestPaid(loan.startingBalanceCents, loan.aprBasisPoints, loan.payments),
    [loan.startingBalanceCents, loan.aprBasisPoints, loan.payments]
  );
  const typeLabel = LOAN_TYPE_LABELS[loan.type] ?? 'Loan';
  const payoffKnown = loan.balanceKnown && monthsLeft !== null && !loan.paidOff;

  return (
    <Card style={{ gap: Space[3], padding: Space[5], minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Space[3] }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <ThemedText style={{ fontFamily: Fonts.heading.semibold, fontSize: 16, lineHeight: 22 }}>
            {loan.label}{' '}
            <ThemedText type="small" themeColor="textSecondary">
              · {typeLabel}
            </ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Payment{' '}
            {loan.minimumPaymentCents > 0 ? formatWholeDollars(loan.minimumPaymentCents) : '—'} ·
            due {loan.dueDay ? ordinal(loan.dueDay) : '—'} · APR {aprOrUnknown(loan.aprBasisPoints)}{' '}
            · lender {loan.lender ?? '—'}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText
            style={{
              fontFamily: Fonts.heading.bold,
              fontSize: 20,
              lineHeight: 26,
              letterSpacing: -0.2,
            }}
          >
            {loan.balanceKnown ? formatWholeDollars(loan.balanceCents) : '—'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            remaining
          </ThemedText>
        </View>
        <ExpandButton open={open} onPress={onToggle} label={loan.label} />
      </View>

      <View style={{ gap: Space[1] }}>
        <ProgressBar percent={loan.paidPercent ?? 0} tone="success" />
        {loan.paidPercent !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            {loan.paidPercent}% paid down
          </ThemedText>
        ) : null}
      </View>
      {loan.paidOff ? <PaidOffChip /> : null}
      <PlanLine plan={plan} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
        <Button
          label="Manage payments"
          variant="panel"
          size="sm"
          shape="rounded"
          accessibilityLabel={`Manage payments for ${loan.label}`}
          onPress={onManage}
        />
        <Button
          label="Plan payment"
          variant="soft"
          size="sm"
          shape="rounded"
          accessibilityLabel={`Plan payment for ${loan.label}`}
          onPress={onPlan}
        />
        <Button
          label={open ? 'Less details' : 'More details'}
          variant="outline"
          size="sm"
          shape="rounded"
          aria-expanded={open}
          accessibilityLabel={`${open ? 'Less' : 'More'} details for ${loan.label}`}
          onPress={onToggle}
        />
      </View>

      {open ? (
        <View
          style={{
            gap: Space[4],
            paddingTop: Space[4],
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <DetailGrid maxColumns={6} minCell={130}>
            <DetailItem label="Principal paid" value={formatCentsCompact(split.principalCents)} />
            <DetailItem label="Interest paid" value={formatCentsCompact(split.interestCents)} />
            <DetailItem label="Total paid" value={formatCentsCompact(loan.totalPaidCents)} />
            <DetailItem label="Term" value={termText(loan.termMonths)} onAdd={onEdit} />
            <DetailItem
              label="Started"
              value={loan.startedOn ? longDate(loan.startedOn) : null}
              onAdd={onEdit}
            />
            <DetailItem
              label="Estimated payoff"
              value={payoffKnown ? `~${monthsLeft} mo left` : loan.paidOff ? 'Paid off' : null}
            />
            <DetailItem label="Payments left" value={payoffKnown ? String(monthsLeft) : null} />
            <DetailItem label="Lender" value={loan.lender} onAdd={onEdit} />
          </DetailGrid>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2], flexWrap: 'wrap' }}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Notes:
            </ThemedText>
            {loan.notes ? (
              <ThemedText type="small">{loan.notes}</ThemedText>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  —
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add notes"
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  onPress={onEdit}
                >
                  <ThemedText type="smallBold" themeColor="solidAccent">
                    Add
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
          <PlanLine plan={plan} label="Paycheck plan" />
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3] }}
          >
            <Button label="Edit" variant="outline" size="sm" shape="rounded" onPress={onEdit} />
            <Button
              label="Delete"
              variant="dangerQuiet"
              size="sm"
              accessibilityLabel={`Delete ${loan.label}`}
              onPress={onAskRemove}
            />
          </View>
          {confirmingRemove ? (
            <ConfirmRemove
              name={loan.label}
              noun="account"
              onCancel={onCancelRemove}
              onConfirm={onConfirmRemove}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
