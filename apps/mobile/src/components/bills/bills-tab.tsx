import { View } from 'react-native';
import { formatCentsCompact } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress-bar';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { CardShadow, Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PlanLine, useMeasuredWidth } from './common';
import type { PlanSummary } from './use-bills-debt-data';
import { shortDate, type BillDisplayStatus, type BillItem } from './view-models';

// Every state carries a word so status never depends on color alone. Overdue
// is the only clay state; Due is a calm mustard, Partial a calm blue.
const STATUS: Record<BillDisplayStatus, { label: string; tone: StatusTone; bar: ProgressTone }> = {
  paid: { label: 'Paid', tone: 'success', bar: 'success' },
  overdue: { label: 'Overdue', tone: 'danger', bar: 'danger' },
  partial: { label: 'Partial', tone: 'info', bar: 'primary' },
  due: { label: 'Due', tone: 'warning', bar: 'primary' },
};

/** Below this row width the bill row stacks instead of laying out on one line. */
const WIDE_ROW = 780;

export interface BillsTabProps {
  bills: BillItem[];
  plans: Record<string, PlanSummary>;
  isLoading: boolean;
  onAddBill: () => void;
  onLogPayment: (bill: BillItem) => void;
  onPlanPayment: (bill: BillItem) => void;
  onToggleReminder: (bill: BillItem, enabled: boolean) => void;
}

export function BillsTab({
  bills,
  plans,
  isLoading,
  onAddBill,
  onLogPayment,
  onPlanPayment,
  onToggleReminder,
}: BillsTabProps) {
  if (bills.length === 0) {
    return (
      <EmptyState
        title={isLoading ? 'Loading your bills…' : 'No bills yet'}
        message={
          isLoading
            ? 'One moment while we gather what is due.'
            : "Add your first bill to start tracking what's due and what you have paid."
        }
        mascot={!isLoading}
        action={isLoading ? undefined : <Button label="+ Add bill" onPress={onAddBill} />}
      />
    );
  }

  return (
    <View style={{ gap: Space[3] }}>
      {bills.map((bill) => (
        <BillRowCard
          key={bill.id}
          bill={bill}
          plan={plans[`bill:${bill.id}`]}
          onLogPayment={() => onLogPayment(bill)}
          onPlanPayment={() => onPlanPayment(bill)}
          onToggleReminder={(enabled) => onToggleReminder(bill, enabled)}
        />
      ))}
    </View>
  );
}

function BillRowCard({
  bill,
  plan,
  onLogPayment,
  onPlanPayment,
  onToggleReminder,
}: {
  bill: BillItem;
  plan?: PlanSummary;
  onLogPayment: () => void;
  onPlanPayment: () => void;
  onToggleReminder: (enabled: boolean) => void;
}) {
  const theme = useTheme();
  const [width, onLayout] = useMeasuredWidth();
  const wide = width >= WIDE_ROW;
  const status = STATUS[bill.displayStatus];
  const percent = bill.amountCents > 0 ? (bill.paidCents / bill.amountCents) * 100 : 0;

  const title = (
    <View style={{ gap: 2, minWidth: 0, flex: wide ? 1 : undefined }}>
      <ThemedText style={{ fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 }}>
        {bill.label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Due {shortDate(bill.dueDate)}
      </ThemedText>
    </View>
  );
  const progress = (
    <View style={{ gap: Space[1], flex: wide ? 1.3 : undefined, minWidth: 0 }}>
      <ProgressBar percent={percent} tone={status.bar} />
      <ThemedText type="small" themeColor="textSecondary">
        {formatCentsCompact(bill.paidCents)} of {formatCentsCompact(bill.amountCents)}
      </ThemedText>
    </View>
  );
  const pill = <StatusPill label={status.label} tone={status.tone} filled />;
  const actions = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] }}>
      <CheckboxField
        label="Remind"
        checked={bill.reminderEnabled}
        onChange={onToggleReminder}
        subtle
      />
      <Button
        label="Log payment"
        size="sm"
        shape="rounded"
        accessibilityLabel={`Log payment for ${bill.label}`}
        onPress={onLogPayment}
      />
      <Button
        label="Plan payment"
        size="sm"
        shape="rounded"
        variant="soft"
        accessibilityLabel={`Plan payment for ${bill.label}`}
        onPress={onPlanPayment}
      />
    </View>
  );

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          backgroundColor: theme.backgroundElement,
          borderRadius: Radius.card,
          paddingVertical: Space[4],
          paddingHorizontal: Space[5],
          gap: Space[3],
        },
        CardShadow,
      ]}
    >
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[5] }}>
          {title}
          {progress}
          <View style={{ width: 84, alignItems: 'center' }}>{pill}</View>
          {actions}
        </View>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: Space[3],
            }}
          >
            {title}
            {pill}
          </View>
          {progress}
          {actions}
        </>
      )}
      {plan && plan.paydayCount > 0 ? <PlanLine plan={plan} /> : null}
    </View>
  );
}
