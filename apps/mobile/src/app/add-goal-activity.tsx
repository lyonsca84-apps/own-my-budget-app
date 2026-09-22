import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  getSavingsGoal,
  isMissingSavingsSchemaError,
  listGoalActivity,
  recordGoalActivity,
  updateGoalActivity,
  type Tables,
} from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { centsToInput, formatMoney, parseDollarsToCents } from '@/components/savings/format';
import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { notifyGoalMilestoneIfCrossed } from '@/lib/notifications';

/**
 * Record a deposit or withdrawal for a goal, or edit an existing entry
 * (`activityId`). Params: `goalId`, optional `kind`, optional prefill
 * (`amountCents`, `note`).
 */
export default function AddGoalActivityScreen() {
  const {
    goalId,
    kind: kindParam,
    activityId,
    amountCents: prefillCents,
    note: prefillNote,
  } = useLocalSearchParams<{
    goalId: string;
    kind?: 'deposit' | 'withdrawal';
    activityId?: string;
    amountCents?: string;
    note?: string;
  }>();
  const { userId } = useDataUser();
  const isEdit = !!activityId;

  const [kind, setKind] = useState<'deposit' | 'withdrawal'>(
    kindParam === 'withdrawal' ? 'withdrawal' : 'deposit'
  );
  const [goal, setGoal] = useState<Tables<'savings_goals'> | null>(null);
  const [existing, setExisting] = useState<Tables<'goal_activity'> | null>(null);
  const [amount, setAmount] = useState(() => {
    const cents = Number(prefillCents);
    return Number.isFinite(cents) && cents > 0 ? centsToInput(cents) : '';
  });
  const [occurredOn, setOccurredOn] = useState(formatLocalDate(new Date()));
  const [note, setNote] = useState(prefillNote ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getSavingsGoal(supabase, goalId);
        if (cancelled) return;
        setGoal(loaded);
        if (activityId) {
          const rows = await listGoalActivity(supabase, goalId);
          const row = rows.find((r) => r.id === activityId);
          if (cancelled) return;
          if (!row) {
            setErrorMessage('That entry no longer exists.');
            return;
          }
          setExisting(row);
          setKind(row.kind === 'withdrawal' ? 'withdrawal' : 'deposit');
          setAmount(centsToInput(row.amount_cents));
          setOccurredOn(row.occurred_on.slice(0, 10));
          setNote(row.note ?? '');
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, activityId]);

  const isWithdrawal = kind === 'withdrawal';

  async function handleSave() {
    if (!goalId) return;
    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setErrorMessage('Enter an amount greater than $0.');
      return;
    }
    if (!isValidIsoDate(occurredOn)) {
      setErrorMessage('Pick a valid date.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const before = await getSavingsGoal(supabase, goalId);

      if (isEdit && existing) {
        const netAfter =
          before.saved_cents + (isWithdrawal ? -1 : 1) * (amountCents - existing.amount_cents);
        if (netAfter < 0) {
          setErrorMessage(`That would leave this goal with less than $0 saved.`);
          return;
        }
        try {
          await updateGoalActivity(supabase, {
            activityId: existing.id,
            amountCents,
            occurredOn,
            note: note.trim() || undefined,
          });
        } catch (error) {
          if (isMissingSavingsSchemaError(error)) {
            setErrorMessage('Editing a deposit arrives with the next app update.');
            return;
          }
          throw error;
        }
        router.back();
        return;
      }

      if (isWithdrawal && amountCents > before.saved_cents) {
        setErrorMessage(`You only have ${formatMoney(before.saved_cents)} saved in this goal.`);
        return;
      }

      await recordGoalActivity(supabase, {
        goalId,
        amountCents,
        kind,
        occurredOn,
        note: note.trim() || undefined,
      });

      if (!isWithdrawal && userId) {
        // The deposit already succeeded above — a failure here (e.g. a
        // notification-permission hiccup) must never surface as an error
        // for an already-successful save.
        try {
          await notifyGoalMilestoneIfCrossed(supabase, userId, {
            goalLabel: before.label,
            previousSavedCents: before.saved_cents,
            newSavedCents: before.saved_cents + amountCents,
            targetCents: before.target_cents,
          });
        } catch {
          // Ignore — the deposit itself is what matters.
        }
      }

      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const goalName = goal?.label ?? '';
  const title = isEdit
    ? `Edit ${isWithdrawal ? 'withdrawal' : 'deposit'}`
    : isWithdrawal
      ? 'Withdraw'
      : 'Add deposit';

  return (
    <DialogScreen
      title={goalName ? `${title} — ${goalName}` : title}
      subtitle={
        goal && !isEdit
          ? `${formatMoney(goal.saved_cents)} saved of ${formatMoney(goal.target_cents)}.`
          : undefined
      }
      primaryLabel={isEdit ? 'Save changes' : isWithdrawal ? 'Save withdrawal' : 'Save deposit'}
      onPrimary={handleSave}
      primaryDisabled={!amount.trim() || (isEdit && !existing)}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      {!isEdit ? (
        <SegmentedControl
          options={[
            { value: 'deposit', label: 'Deposit' },
            { value: 'withdrawal', label: 'Withdrawal' },
          ]}
          value={kind}
          onChange={setKind}
          variant="soft"
          accessibilityLabel="Deposit or withdrawal"
        />
      ) : null}
      <TextField
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <DateField label="Date" value={occurredOn} onChange={setOccurredOn} />
      <TextField
        label="Note (optional)"
        placeholder="Where did it come from?"
        value={note}
        onChangeText={setNote}
      />
    </DialogScreen>
  );
}
