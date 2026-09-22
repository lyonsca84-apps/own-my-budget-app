import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  createSavingsChallenge,
  createSavingsGoal,
  getSavingsGoal,
  isMissingSavingsSchemaError,
  listSavingsChallenges,
  recordGoalActivity,
  updateSavingsChallenge,
  updateSavingsGoal,
} from '@own-my-budget/api';
import {
  CHALLENGE_MULTIPLIERS,
  GOAL_CATEGORIES,
  GOAL_FREQUENCIES,
  GOAL_FREQUENCY_LABELS,
  calculateEmergencyFundTarget,
  challengeTargetCents,
  formatLocalDate,
  resolveGoalCategory,
  resolveGoalFrequency,
  type GoalCategory,
  type GoalFrequency,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { centsToInput, formatMoney, parseDollarsToCents } from '@/components/savings/format';
import { Button } from '@/components/ui/button';
import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { GOAL_SWATCHES, SwatchPicker } from '@/components/ui/swatch-picker';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const CHALLENGE_NAME = '52-Week Money Challenge';

const CATEGORY_OPTIONS = GOAL_CATEGORIES.map((c) => ({ value: c, label: c }));
const FREQUENCY_OPTIONS = GOAL_FREQUENCIES.map((f) => ({
  value: f,
  label: GOAL_FREQUENCY_LABELS[f],
}));
const MULTIPLIER_OPTIONS = CHALLENGE_MULTIPLIERS.map((m) => ({
  value: String(m),
  label: `$${m} Multiplier`,
}));

/**
 * Add / edit a savings goal (or the 52-week challenge) in the design's dialog.
 * Params: `goalId` edits; `preset=challenge` starts the challenge;
 * `preset=emergency` prefills an emergency fund.
 */
export default function AddSavingsGoalScreen() {
  const { goalId, preset } = useLocalSearchParams<{
    goalId?: string;
    preset?: 'emergency' | 'challenge';
  }>();
  const isEdit = !!goalId;
  const { userId } = useDataUser();

  const [isChallenge, setIsChallenge] = useState(preset === 'challenge');
  const [label, setLabel] = useState(
    preset === 'emergency' ? 'Emergency Fund' : preset === 'challenge' ? CHALLENGE_NAME : ''
  );
  const [category, setCategory] = useState<GoalCategory>(
    preset === 'emergency' ? 'Emergency Fund' : 'General Savings'
  );
  const [frequency, setFrequency] = useState<GoalFrequency>('monthly');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [startDate, setStartDate] = useState(formatLocalDate(new Date()));
  const [targetDate, setTargetDate] = useState('');
  const [planned, setPlanned] = useState('');
  const [account, setAccount] = useState('');
  const [color, setColor] = useState<string>(GOAL_SWATCHES[0]);
  const [notes, setNotes] = useState('');
  const [multiplier, setMultiplier] = useState('1');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [months, setMonths] = useState('3');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [isLoadingGoal, setIsLoadingGoal] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const goal = await getSavingsGoal(supabase, goalId);
        if (cancelled) return;
        setIsChallenge(goal.is_challenge);
        setLabel(goal.label);
        setCategory(resolveGoalCategory(goal.category, goal.label));
        setFrequency(resolveGoalFrequency(goal.frequency));
        setTarget(centsToInput(goal.target_cents));
        setCurrent(centsToInput(goal.saved_cents));
        setStartDate((goal.start_date ?? goal.created_at).slice(0, 10));
        setTargetDate(goal.target_date ?? '');
        setPlanned(centsToInput(goal.planned_deposit_cents));
        setAccount(goal.account_label ?? '');
        setColor(goal.color ?? GOAL_SWATCHES[0]);
        setNotes(goal.notes ?? '');
        if (goal.is_challenge) {
          const challenges = await listSavingsChallenges(supabase, userId);
          const row = challenges.find((c) => c.goal_id === goal.id);
          if (row && !cancelled) {
            setChallengeId(row.id);
            setMultiplier(String(row.multiplier ?? 1));
            setStartDate((row.start_date ?? goal.start_date ?? row.created_at).slice(0, 10));
            setNotes(row.notes ?? '');
          }
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      } finally {
        if (!cancelled) setIsLoadingGoal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, userId]);

  const suggestedEmergencyCents = useMemo(
    () =>
      calculateEmergencyFundTarget(
        parseDollarsToCents(monthlyExpenses) ?? 0,
        parseFloat(months) || 0
      ),
    [monthlyExpenses, months]
  );
  const showEmergencyHelper = !isChallenge && category === 'Emergency Fund' && !isEdit;

  async function handleSave() {
    if (!userId) return;
    const name = label.trim();
    if (!name) {
      setErrorMessage('Give your goal a name.');
      return;
    }
    if (startDate && !isValidIsoDate(startDate)) {
      setErrorMessage('Enter the start date as YYYY-MM-DD.');
      return;
    }
    if (targetDate && !isValidIsoDate(targetDate)) {
      setErrorMessage('Enter the target date as YYYY-MM-DD.');
      return;
    }
    if (startDate && targetDate && targetDate < startDate) {
      setErrorMessage('The target date must be on or after the start date.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (isChallenge) await saveChallenge(name);
      else await saveGoal(name);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveGoal(name: string) {
    if (!userId) return;
    const targetCents = parseDollarsToCents(target);
    if (!targetCents || targetCents <= 0) throw new Error('Enter a target amount greater than $0.');
    const currentCents = parseDollarsToCents(current) ?? 0;
    const plannedCents = planned.trim() ? parseDollarsToCents(planned) : null;
    if (planned.trim() && plannedCents === null) {
      throw new Error('Enter the planned deposit as a dollar amount, or leave it blank.');
    }
    if (current.trim() && parseDollarsToCents(current) === null) {
      throw new Error('Enter the current saved amount as a dollar amount, or leave it blank.');
    }

    const designFields = {
      category,
      frequency,
      start_date: startDate || null,
      planned_deposit_cents: plannedCents,
      account_label: account.trim() || null,
      color,
      notes: notes.trim() || null,
    };

    if (isEdit && goalId) {
      try {
        await updateSavingsGoal(supabase, goalId, {
          label: name,
          target_cents: targetCents,
          target_date: targetDate || null,
          ...designFields,
        });
      } catch (error) {
        if (!isMissingSavingsSchemaError(error)) throw error;
        await updateSavingsGoal(supabase, goalId, {
          label: name,
          target_cents: targetCents,
          target_date: targetDate || null,
        });
      }
      return;
    }

    const base = {
      user_id: userId,
      label: name,
      target_cents: targetCents,
      target_date: targetDate || null,
    };
    let goal;
    try {
      goal = await createSavingsGoal(supabase, { ...base, ...designFields });
    } catch (error) {
      if (!isMissingSavingsSchemaError(error)) throw error;
      goal = await createSavingsGoal(supabase, base);
    }
    if (currentCents > 0) {
      // Record the starting balance as a deposit so the history always adds up to the saved total.
      await recordGoalActivity(supabase, {
        goalId: goal.id,
        amountCents: currentCents,
        kind: 'deposit',
        occurredOn: startDate || formatLocalDate(new Date()),
        note: 'Starting balance',
      });
    }
  }

  async function saveChallenge(name: string) {
    if (!userId) return;
    const m = Number(multiplier) || 1;
    const start = startDate || formatLocalDate(new Date());
    const challengeFields = { start_date: start, notes: notes.trim() || null };

    if (isEdit && goalId) {
      // The multiplier (and so the target) is changed inside the challenge dialog.
      try {
        await updateSavingsGoal(supabase, goalId, { label: name, start_date: start });
      } catch (error) {
        if (!isMissingSavingsSchemaError(error)) throw error;
        await updateSavingsGoal(supabase, goalId, { label: name });
      }
      if (challengeId) {
        try {
          await updateSavingsChallenge(supabase, challengeId, challengeFields);
        } catch (error) {
          if (!isMissingSavingsSchemaError(error)) throw error;
        }
      }
      return;
    }

    const goalBase = {
      user_id: userId,
      label: name,
      target_cents: challengeTargetCents(52, m),
      is_challenge: true,
    };
    let goal;
    try {
      goal = await createSavingsGoal(supabase, {
        ...goalBase,
        category: 'General Savings',
        frequency: 'weekly',
        start_date: start,
        color,
      });
    } catch (error) {
      if (!isMissingSavingsSchemaError(error)) throw error;
      goal = await createSavingsGoal(supabase, goalBase);
    }
    const challengeBase = {
      user_id: userId,
      goal_id: goal.id,
      challenge_type: 'classic_ascending',
      total_weeks: 52,
    };
    try {
      await createSavingsChallenge(supabase, {
        ...challengeBase,
        multiplier: m,
        ...challengeFields,
      });
    } catch (error) {
      if (!isMissingSavingsSchemaError(error)) throw error;
      await createSavingsChallenge(supabase, challengeBase);
    }
  }

  const title = isChallenge
    ? isEdit
      ? 'Edit challenge'
      : 'Start a 52-week challenge'
    : isEdit
      ? 'Edit savings goal'
      : 'Add savings goal';
  const subtitle = isChallenge
    ? 'Save a little more each week for a year.'
    : 'Set the target, timeline, and deposit plan.';

  return (
    <DialogScreen
      title={title}
      subtitle={subtitle}
      primaryLabel={isEdit ? 'Save changes' : isChallenge ? 'Start challenge' : 'Create goal'}
      onPrimary={handleSave}
      primaryDisabled={isLoadingGoal || !label.trim()}
      busy={isSubmitting}
      errorMessage={errorMessage}
    >
      <View style={{ gap: Space[3] }}>
        <TextField
          label="Goal name"
          hideLabel
          placeholder="Goal name"
          value={label}
          onChangeText={setLabel}
        />

        {isChallenge ? (
          <>
            {!isEdit ? (
              <SelectField
                label="Multiplier"
                value={multiplier}
                onChange={setMultiplier}
                options={MULTIPLIER_OPTIONS}
              />
            ) : null}
            {!isEdit ? (
              <ThemedText type="small" themeColor="textSecondary">
                Week 1 is ${multiplier}, week 2 is ${Number(multiplier) * 2}, and so on up to week
                52 — {formatMoney(challengeTargetCents(52, Number(multiplier) || 1))} in all.
              </ThemedText>
            ) : null}
            <DateField label="Start date" value={startDate} onChange={setStartDate} />
            <TextField
              label="Notes (optional)"
              hideLabel
              placeholder="Notes (optional)"
              rows={3}
              value={notes}
              onChangeText={setNotes}
            />
          </>
        ) : (
          <>
            <Row>
              <SelectField
                label="Category"
                hideLabel
                value={category}
                onChange={(value) => setCategory(value as GoalCategory)}
                options={CATEGORY_OPTIONS}
              />
              <SelectField
                label="Deposit frequency"
                hideLabel
                value={frequency}
                onChange={(value) => setFrequency(value as GoalFrequency)}
                options={FREQUENCY_OPTIONS}
              />
            </Row>
            <Row>
              <TextField
                label="Target amount"
                hideLabel
                placeholder="Target amount"
                keyboardType="decimal-pad"
                value={target}
                onChangeText={setTarget}
              />
              <TextField
                label="Current saved amount"
                hideLabel
                placeholder="Current saved amount"
                keyboardType="decimal-pad"
                value={current}
                onChangeText={setCurrent}
                // Editing the balance directly would leave the deposit history out of step.
                editable={!isEdit}
                helperText={isEdit ? 'Change this by adding or editing deposits.' : undefined}
              />
            </Row>

            {showEmergencyHelper ? (
              <View style={{ gap: Space[2] }}>
                <ThemedText type="smallBold">Not sure what to aim for?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Most people aim for three to six months of essential expenses.
                </ThemedText>
                <Row>
                  <TextField
                    label="Monthly essential expenses"
                    placeholder="Monthly essential expenses"
                    keyboardType="decimal-pad"
                    value={monthlyExpenses}
                    onChangeText={setMonthlyExpenses}
                  />
                  <TextField
                    label="Months to cover"
                    keyboardType="number-pad"
                    value={months}
                    onChangeText={setMonths}
                  />
                </Row>
                {suggestedEmergencyCents > 0 ? (
                  <Button
                    label={`Use ${formatMoney(suggestedEmergencyCents)} as my target`}
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    onPress={() => setTarget(centsToInput(suggestedEmergencyCents))}
                  />
                ) : null}
              </View>
            ) : null}

            <Row>
              <DateField label="Start date" value={startDate} onChange={setStartDate} />
              <DateField
                label="Target date"
                value={targetDate}
                onChange={setTargetDate}
                min={startDate}
              />
            </Row>
            <Row>
              <TextField
                label="Planned deposit amount"
                hideLabel
                placeholder="Planned deposit amount"
                keyboardType="decimal-pad"
                value={planned}
                onChangeText={setPlanned}
              />
              <TextField
                label="Account / savings location"
                hideLabel
                placeholder="Account / savings location"
                value={account}
                onChangeText={setAccount}
              />
            </Row>
            <SwatchPicker
              colors={GOAL_SWATCHES}
              value={color}
              onChange={setColor}
              label="Goal color"
              names={['Teal', 'Blue', 'Navy', 'Green', 'Lime']}
            />
            <TextField
              label="Notes (optional)"
              hideLabel
              placeholder="Notes (optional)"
              rows={3}
              value={notes}
              onChangeText={setNotes}
            />
          </>
        )}
      </View>
    </DialogScreen>
  );
}

/** Two fields side by side, stacking on narrow screens. */
function Row({ children }: { children: React.ReactNode[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
      {children.map((child, index) => (
        <View key={index} style={{ flexGrow: 1, flexBasis: 220, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
