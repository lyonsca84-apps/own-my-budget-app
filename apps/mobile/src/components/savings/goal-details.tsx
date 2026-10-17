import { useState } from 'react';
import { View } from 'react-native';
import { GOAL_FREQUENCY_LABELS } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { formatMoney, formatShortDate, formatWholeDollars } from '@/components/savings/format';
import type { GoalActivityView, GoalView } from '@/components/savings/use-savings-data';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface GoalDetailsProps {
  goal: GoalView;
  /** False when the connected database predates the savings design migration (no Pause, no deposit edit/delete). */
  designSchema: boolean;
  onPlanPayment: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
  onEditDeposit: (deposit: GoalActivityView) => void;
  onDeleteDeposit: (deposit: GoalActivityView) => void;
  errorMessage?: string | null;
}

/**
 * The expanded body of a goal card: dates, deposit plan, paycheck assignment,
 * Plan payment / Edit / Pause / Delete, and the deposit history with a per-row
 * Edit and Delete. Destructive actions confirm inline — no browser dialogs.
 */
export function GoalDetails({
  goal,
  designSchema,
  onPlanPayment,
  onEdit,
  onTogglePause,
  onDelete,
  onEditDeposit,
  onDeleteDeposit,
  errorMessage,
}: GoalDetailsProps) {
  const theme = useTheme();
  const [confirmingGoal, setConfirmingGoal] = useState(false);
  const [confirmingDeposit, setConfirmingDeposit] = useState<string | null>(null);

  return (
    <View style={{ gap: Space[3] }}>
      <View style={{ height: 1, backgroundColor: theme.border }} />

      <View style={{ gap: Space[1] }}>
        <ThemedText type="small" themeColor="textSecondary">
          Start {formatShortDate(goal.startDate)} · Target{' '}
          {goal.targetDate ? formatShortDate(goal.targetDate) : 'no date set'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {GOAL_FREQUENCY_LABELS[goal.frequency]}
          {goal.suggestedCents !== null
            ? ` · suggested ${formatWholeDollars(goal.suggestedCents)}/period`
            : ''}
        </ThemedText>
        {goal.plannedDepositCents ? (
          <ThemedText type="small" themeColor="textSecondary">
            Planned deposit {formatMoney(goal.plannedDepositCents)}
            {goal.accountLabel ? ` · ${goal.accountLabel}` : ''}
          </ThemedText>
        ) : goal.accountLabel ? (
          <ThemedText type="small" themeColor="textSecondary">
            Kept in {goal.accountLabel}
          </ThemedText>
        ) : null}
        {goal.notes ? (
          <ThemedText type="small" themeColor="textSecondary">
            {goal.notes}
          </ThemedText>
        ) : null}
        <ThemedText type="smallBold" style={{ color: theme.solidAccent }}>
          Assigned to paycheck: {goal.assignmentLabel}
        </ThemedText>
      </View>

      {confirmingGoal ? (
        <View
          accessibilityRole="alert"
          style={{
            gap: Space[2],
            padding: Space[3],
            borderRadius: 12,
            backgroundColor: theme.clayMuted,
          }}
        >
          <ThemedText type="smallBold" style={{ color: theme.clay }}>
            Delete {goal.title}?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            It leaves your goals. Its deposit history is kept.
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: Space[2] }}>
            <Button
              label="Keep goal"
              variant="soft"
              size="sm"
              shape="rounded"
              onPress={() => setConfirmingGoal(false)}
            />
            <Button
              label="Yes, delete"
              variant="danger"
              size="sm"
              shape="rounded"
              onPress={() => {
                setConfirmingGoal(false);
                onDelete();
              }}
              accessibilityLabel={`Yes, delete ${goal.title}`}
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
          <Button
            label="Plan payment"
            variant="soft"
            size="sm"
            shape="rounded"
            onPress={onPlanPayment}
            accessibilityLabel={`Plan payment for ${goal.title}`}
          />
          <Button
            label="Edit"
            variant="soft"
            size="sm"
            shape="rounded"
            onPress={onEdit}
            accessibilityLabel={`Edit ${goal.title}`}
          />
          {designSchema ? (
            <Button
              label={goal.isPaused ? 'Resume' : 'Pause'}
              variant="outline"
              size="sm"
              shape="rounded"
              onPress={onTogglePause}
              accessibilityLabel={`${goal.isPaused ? 'Resume' : 'Pause'} ${goal.title}`}
            />
          ) : null}
          <Button
            label="Delete"
            variant="dangerOutline"
            size="sm"
            shape="rounded"
            onPress={() => setConfirmingGoal(true)}
            accessibilityLabel={`Delete ${goal.title}`}
          />
        </View>
      )}

      {!designSchema ? (
        <ThemedText type="small" themeColor="textSecondary">
          Pausing a goal and editing individual deposits arrive with the next app update.
        </ThemedText>
      ) : null}

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {errorMessage}
        </ThemedText>
      ) : null}

      <View style={{ height: 1, backgroundColor: theme.border }} />
      <ThemedText type="smallBold" style={{ color: theme.solidAccent }}>
        Deposit history
      </ThemedText>
      {goal.deposits.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No deposits recorded yet.
        </ThemedText>
      ) : (
        <View>
          {goal.deposits.map((deposit, index) => {
            const isWithdrawal = deposit.kind === 'withdrawal';
            const confirming = confirmingDeposit === deposit.id;
            return (
              <View
                key={deposit.id}
                style={{
                  gap: Space[1],
                  paddingVertical: Space[2],
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  <ThemedText type="smallBold">{deposit.occurredOn.slice(0, 10)}</ThemedText>
                  {isWithdrawal ? ' · Withdrawal' : ''}
                  {deposit.note ? ` · ${deposit.note}` : ''}
                </ThemedText>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: Space[3],
                  }}
                >
                  <ThemedText type="smallBold">
                    {isWithdrawal ? '−' : ''}
                    {formatMoney(deposit.amountCents)}
                  </ThemedText>
                  {!designSchema ? null : confirming ? (
                    <>
                      <ThemedText type="small" style={{ color: theme.clay }}>
                        Delete this entry?
                      </ThemedText>
                      <Button
                        label="Yes"
                        variant="dangerQuiet"
                        size="sm"
                        onPress={() => {
                          setConfirmingDeposit(null);
                          onDeleteDeposit(deposit);
                        }}
                        accessibilityLabel={`Yes, delete the ${formatMoney(deposit.amountCents)} entry from ${deposit.occurredOn.slice(0, 10)}`}
                      />
                      <Button
                        label="No"
                        variant="quiet"
                        size="sm"
                        onPress={() => setConfirmingDeposit(null)}
                      />
                    </>
                  ) : (
                    <>
                      <Button
                        label="Edit"
                        variant="quiet"
                        size="sm"
                        onPress={() => onEditDeposit(deposit)}
                        accessibilityLabel={`Edit the ${formatMoney(deposit.amountCents)} entry from ${deposit.occurredOn.slice(0, 10)}`}
                      />
                      <Button
                        label="Delete"
                        variant="dangerQuiet"
                        size="sm"
                        onPress={() => setConfirmingDeposit(deposit.id)}
                        accessibilityLabel={`Delete the ${formatMoney(deposit.amountCents)} entry from ${deposit.occurredOn.slice(0, 10)}`}
                      />
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
