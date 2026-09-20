import { Pressable, Switch, View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress-bar';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LabelText, PlanLine } from './common';
import type { PlanSummary } from './use-bills-debt-data';
import { longDate, type BillDisplayStatus, type BillItem } from './view-models';

// Every state carries a word (and a glyph for paid/overdue) so status never
// depends on color alone. Overdue is the only clay state; the rest stay calm.
const STATUS: Record<BillDisplayStatus, { label: string; tone: StatusTone; bar: ProgressTone }> = {
  paid: { label: '✓ Paid', tone: 'success', bar: 'success' },
  overdue: { label: '! Overdue', tone: 'danger', bar: 'danger' },
  partial: { label: 'Partial', tone: 'neutral', bar: 'primary' },
  due: { label: 'Due', tone: 'neutral', bar: 'primary' },
};

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
        <BillCard
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

function BillCard({
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
  const status = STATUS[bill.displayStatus];
  const percent = bill.amountCents > 0 ? (bill.paidCents / bill.amountCents) * 100 : 0;

  return (
    <Card style={{ gap: Space[3] }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: Space[3],
        }}
      >
        <View style={{ flexShrink: 1, minWidth: 160 }}>
          <LabelText>{bill.label}</LabelText>
          <ThemedText type="small" themeColor="textSecondary">
            Due {longDate(bill.dueDate)}
          </ThemedText>
        </View>
        <StatusPill label={status.label} tone={status.tone} />
      </View>

      <View style={{ gap: Space[1] }}>
        <ProgressBar percent={percent} tone={status.bar} />
        <ThemedText type="small" themeColor="textSecondary">
          {formatCents(bill.paidCents)} of {formatCents(bill.amountCents)} paid
          {bill.remainingCents > 0 && bill.paidCents > 0
            ? ` · ${formatCents(bill.remainingCents)} left`
            : ''}
        </ThemedText>
      </View>

      {plan && plan.paydayCount > 0 ? <PlanLine plan={plan} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`Remind me about ${bill.label}`}
          accessibilityState={{ checked: bill.reminderEnabled }}
          onPress={() => onToggleReminder(!bill.reminderEnabled)}
          style={{
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Space[2],
            paddingRight: Space[2],
          }}
        >
          {/* Display only — the whole row is the switch, so taps never double-fire on web. */}
          <View pointerEvents="none">
            <Switch
              value={bill.reminderEnabled}
              accessible={false}
              importantForAccessibility="no"
              trackColor={{ false: theme.controlBorder, true: theme.primary }}
              thumbColor={theme.backgroundElement}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Remind
          </ThemedText>
        </Pressable>
        <Button
          label="Log payment"
          variant={bill.displayStatus === 'paid' ? 'secondary' : 'primary'}
          accessibilityLabel={`Log a payment for ${bill.label}`}
          onPress={onLogPayment}
        />
        <Button
          label="Plan payment"
          variant="secondary"
          accessibilityLabel={`Plan a payment for ${bill.label}`}
          onPress={onPlanPayment}
        />
      </View>
    </Card>
  );
}
