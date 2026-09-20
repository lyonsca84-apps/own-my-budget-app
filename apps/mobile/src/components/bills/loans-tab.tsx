import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { estimateInterestPaid, formatCents, monthsToPayOff } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ConfirmRemove, DangerButton, LabelText, PaidOffChip, PlanLine } from './common';
import { DetailGrid, DetailItem, SummaryTile, SummaryTiles } from './detail-grid';
import type { PlanSummary } from './use-bills-debt-data';
import {
  LOAN_FILTERS,
  LOAN_TYPE_LABELS,
  formatApr,
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
  const theme = useTheme();
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
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}
      >
        {LOAN_FILTERS.map((option) => {
          const selected = option.value === filter;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option.value)}
              style={{
                minHeight: 44,
                paddingHorizontal: Space[4],
                borderRadius: Radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? theme.primary : theme.primaryMuted,
              }}
            >
              <ThemedText type="smallBold" themeColor={selected ? 'onPrimary' : 'primary'}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SummaryTiles>
        <SummaryTile
          label="Total original amount"
          value={formatCents(totals.originalCents)}
          tone="panel"
        />
        <SummaryTile
          label="Total current balance"
          value={formatCents(totals.currentCents)}
          tone="primary"
        />
        <SummaryTile label="Total paid" value={formatCents(totals.paidCents)} tone="success" />
        <SummaryTile label="Total monthly payments" value={formatCents(totals.monthlyCents)} />
        <SummaryTile label="Est. monthly interest" value={formatCents(totals.interestCents)} />
        <SummaryTile
          label="Mortgage balance"
          value={formatCents(totals.mortgageCents)}
          tone="accent"
        />
        <SummaryTile
          label="Other loan balance"
          value={formatCents(totals.otherCents)}
          tone="accent"
        />
        <SummaryTile label="Active accounts" value={String(totals.active)} />
        <SummaryTile label="Paid-off accounts" value={String(totals.paidOff)} />
      </SummaryTiles>

      <View style={{ alignItems: 'flex-end' }}>
        <Button label="+ Add loan or mortgage" onPress={props.onAddLoan} />
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

  return (
    <Card style={{ gap: Space[3], minWidth: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: Space[3],
        }}
      >
        <View style={{ flexShrink: 1, minWidth: 180, gap: 2 }}>
          <LabelText>
            {loan.label}{' '}
            <ThemedText type="small" themeColor="textSecondary">
              · {typeLabel}
            </ThemedText>
          </LabelText>
          <ThemedText type="small" themeColor="textSecondary">
            Payment {formatCents(loan.minimumPaymentCents)} · due{' '}
            {loan.dueDay ? ordinal(loan.dueDay) : '—'} · APR {formatApr(loan.aprBasisPoints)} ·
            lender {loan.lender ?? '—'}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText type="amountSmall">{formatCents(loan.balanceCents)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            remaining
          </ThemedText>
        </View>
      </View>

      {loan.paidPercent !== null ? (
        <View style={{ gap: Space[1] }}>
          <ProgressBar percent={loan.paidPercent} tone="success" />
          <ThemedText type="small" themeColor="textSecondary">
            {loan.paidPercent}% paid down
          </ThemedText>
        </View>
      ) : null}
      {loan.paidOff ? <PaidOffChip /> : null}
      <PlanLine plan={plan} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
        <Button label="Manage payments" variant="panel" onPress={onManage} />
        <Button label="Plan payment" variant="secondary" onPress={onPlan} />
        <Button
          label={open ? 'Less details ▴' : 'More details ▾'}
          variant="secondary"
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
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
          <DetailGrid>
            <DetailItem label="Est. principal paid" value={formatCents(split.principalCents)} />
            <DetailItem label="Est. interest paid" value={formatCents(split.interestCents)} />
            <DetailItem label="Total paid" value={formatCents(loan.totalPaidCents)} />
            <DetailItem label="Term" value={termText(loan.termMonths)} onAdd={onEdit} />
            <DetailItem
              label="Started"
              value={loan.startedOn ? longDate(loan.startedOn) : null}
              onAdd={onEdit}
            />
            <DetailItem
              label="Estimated payoff"
              value={
                monthsLeft !== null && !loan.paidOff
                  ? `~${monthsLeft} mo left`
                  : loan.paidOff
                    ? 'Paid off'
                    : null
              }
            />
            <DetailItem
              label="Payments left"
              value={monthsLeft !== null && !loan.paidOff ? String(monthsLeft) : null}
            />
            <DetailItem label="Lender" value={loan.lender} onAdd={onEdit} />
          </DetailGrid>
          <DetailItem label="Notes" value={loan.notes} onAdd={onEdit} />
          <PlanLine plan={plan} label="Paycheck plan" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button label="Edit" variant="secondary" onPress={onEdit} />
            <DangerButton label="Delete" onPress={onAskRemove} />
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
