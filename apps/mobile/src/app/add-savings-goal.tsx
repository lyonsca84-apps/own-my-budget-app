import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  createSavingsChallenge,
  createSavingsGoal,
  getSavingsGoal,
  updateSavingsGoal,
} from '@own-my-budget/api';
import {
  GOAL_CATEGORIES,
  calculateEmergencyFundTarget,
  formatCents,
  generateChallengeAmounts,
  inferGoalCategory,
  type ChallengeType,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// 'custom' is a valid ChallengeType for the core function but isn't offered
// as a UI choice here — building a custom-per-week editor is out of scope.
const CHALLENGE_TYPES: Exclude<ChallengeType, 'custom'>[] = [
  'classic_ascending',
  'flat',
  'reverse',
];
const CHALLENGE_LABEL: Record<ChallengeType, string> = {
  classic_ascending: 'Classic ($1, $2, $3…)',
  flat: 'Flat (same each week)',
  reverse: 'Reverse (big weeks first)',
  custom: 'Custom',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function AddSavingsGoalScreen() {
  const { goalId, preset } = useLocalSearchParams<{
    goalId?: string;
    preset?: 'emergency' | 'challenge';
  }>();
  const isEdit = !!goalId;
  const { user } = useAuth();
  const theme = useTheme();

  const [label, setLabel] = useState(preset === 'emergency' ? 'Emergency Fund' : '');
  const [targetDate, setTargetDate] = useState('');
  const [isChallenge, setIsChallenge] = useState(preset === 'challenge');
  const [challengeType, setChallengeType] = useState<ChallengeType>('classic_ascending');
  const [flatTarget, setFlatTarget] = useState('1378'); // classic 52-week total default
  const [manualTarget, setManualTarget] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [months, setMonths] = useState('3');
  const [isLoadingGoal, setIsLoadingGoal] = useState(isEdit);
  const [editingChallenge, setEditingChallenge] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) return;
    let cancelled = false;
    getSavingsGoal(supabase, goalId)
      .then((goal) => {
        if (cancelled) return;
        setLabel(goal.label);
        setTargetDate(goal.target_date ?? '');
        setManualTarget(String(goal.target_cents / 100));
        setEditingChallenge(goal.is_challenge);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Could not load.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGoal(false);
      });
    return () => {
      cancelled = true;
    };
  }, [goalId]);

  const challengeAmounts = isChallenge
    ? generateChallengeAmounts(challengeType, 52, {
        targetCents: Math.round((parseFloat(flatTarget) || 0) * 100),
      })
    : null;
  const challengeTotalCents = challengeAmounts?.reduce((a, b) => a + b, 0) ?? 0;

  const showCategoryChips =
    !isEdit &&
    !isChallenge &&
    (label === '' || (GOAL_CATEGORIES as readonly string[]).includes(label));
  const isEmergencyLabel = !isChallenge && !isEdit && inferGoalCategory(label) === 'Emergency Fund';
  const suggestedEmergencyCents = calculateEmergencyFundTarget(
    Math.round((parseFloat(monthlyExpenses) || 0) * 100),
    parseFloat(months) || 0
  );

  async function handleSave() {
    if (!user) return;
    const trimmedDate = targetDate.trim();
    if (trimmedDate && !isValidDate(trimmedDate)) {
      setErrorMessage('Enter the target date as YYYY-MM-DD, for example 2027-06-01.');
      return;
    }
    const targetCents = isChallenge
      ? challengeTotalCents
      : Math.round((parseFloat(manualTarget) || 0) * 100);
    if (!Number.isFinite(targetCents) || targetCents <= 0) {
      setErrorMessage('Enter a valid target amount.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (isEdit && goalId) {
        await updateSavingsGoal(supabase, goalId, {
          label: label.trim(),
          target_date: trimmedDate || null,
          // A challenge's weekly amounts are derived from its total, so the
          // total stays fixed once the challenge has started.
          ...(editingChallenge ? {} : { target_cents: targetCents }),
        });
      } else {
        const goal = await createSavingsGoal(supabase, {
          user_id: user.id,
          label: label.trim(),
          target_cents: targetCents,
          target_date: trimmedDate || null,
          is_challenge: isChallenge,
        });
        if (isChallenge) {
          await createSavingsChallenge(supabase, {
            user_id: user.id,
            goal_id: goal.id,
            challenge_type: challengeType,
            total_weeks: 52,
          });
        }
      }
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isEdit ? 'Edit goal' : 'Add savings goal' }} />

      <TextField
        label="What are you saving for?"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Emergency Fund"
      />

      {showCategoryChips ? (
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="smallBold">Quick start</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {GOAL_CATEGORIES.filter((c) => c !== 'General Savings').map((category) => {
              const selected = label === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setLabel(selected ? '' : category)}
                  style={{
                    minHeight: Layout.minimumTouchTarget,
                    justifyContent: 'center',
                    paddingHorizontal: Spacing.three,
                    borderRadius: Radius.full,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.panel : theme.controlBorder,
                    backgroundColor: selected ? theme.panel : 'transparent',
                  }}
                >
                  <ThemedText type="smallBold" themeColor={selected ? 'onPanel' : 'text'}>
                    {selected ? '✓ ' : ''}
                    {category}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {!isEdit ? (
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
          <Button
            label="Regular goal"
            variant={!isChallenge ? 'primary' : 'secondary'}
            onPress={() => setIsChallenge(false)}
          />
          <Button
            label="52-week challenge"
            variant={isChallenge ? 'primary' : 'secondary'}
            onPress={() => setIsChallenge(true)}
          />
        </View>
      ) : null}

      {isChallenge ? (
        <>
          <View style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold">Challenge style</ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              {CHALLENGE_TYPES.map((option) => (
                <Button
                  key={option}
                  label={CHALLENGE_LABEL[option]}
                  variant={option === challengeType ? 'primary' : 'secondary'}
                  onPress={() => setChallengeType(option)}
                />
              ))}
            </View>
          </View>
          <TextField
            label="Target total for the year"
            value={flatTarget}
            onChangeText={setFlatTarget}
            placeholder="1378"
            keyboardType="decimal-pad"
          />
          <ThemedText type="small" themeColor="textSecondary">
            52 weekly deposits totaling {formatCents(challengeTotalCents)}.
          </ThemedText>
        </>
      ) : editingChallenge ? (
        <ThemedText type="small" themeColor="textSecondary">
          This challenge&rsquo;s total is{' '}
          {formatCents(Math.round((parseFloat(manualTarget) || 0) * 100))} and stays fixed so your
          weekly amounts don&rsquo;t change mid-challenge. You can rename it or set a finish date.
        </ThemedText>
      ) : (
        <TextField
          label="Target amount"
          value={manualTarget}
          onChangeText={setManualTarget}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      )}

      {isEmergencyLabel ? (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold">Not sure what to aim for?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Most people aim for three to six months of essential expenses.
          </ThemedText>
          <TextField
            label="Monthly essential expenses"
            value={monthlyExpenses}
            onChangeText={setMonthlyExpenses}
            placeholder="2000"
            keyboardType="decimal-pad"
          />
          <TextField
            label="Months to cover"
            value={months}
            onChangeText={setMonths}
            placeholder="3"
            keyboardType="number-pad"
          />
          {suggestedEmergencyCents > 0 ? (
            <Button
              label={`Use ${formatCents(suggestedEmergencyCents)} as my target`}
              variant="secondary"
              onPress={() => setManualTarget(String(suggestedEmergencyCents / 100))}
            />
          ) : null}
        </View>
      ) : null}

      <TextField
        label="Target date (optional)"
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="YYYY-MM-DD"
      />

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save goal'}
        onPress={handleSave}
        disabled={isSubmitting || isLoadingGoal || !label.trim()}
      />
    </Screen>
  );
}
