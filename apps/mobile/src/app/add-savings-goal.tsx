import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { createSavingsChallenge, createSavingsGoal } from '@own-my-budget/api';
import { formatCents, generateChallengeAmounts, type ChallengeType } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

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

export default function AddSavingsGoalScreen() {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isChallenge, setIsChallenge] = useState(false);
  const [challengeType, setChallengeType] = useState<ChallengeType>('classic_ascending');
  const [flatTarget, setFlatTarget] = useState('1378'); // classic 52-week total default
  const [manualTarget, setManualTarget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const challengeAmounts = isChallenge
    ? generateChallengeAmounts(challengeType, 52, {
        targetCents: Math.round((parseFloat(flatTarget) || 0) * 100),
      })
    : null;
  const challengeTotalCents = challengeAmounts?.reduce((a, b) => a + b, 0) ?? 0;

  async function handleSave() {
    if (!user) return;
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
      const goal = await createSavingsGoal(supabase, {
        user_id: user.id,
        label: label.trim(),
        target_cents: targetCents,
        target_date: targetDate.trim() || null,
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
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <TextField
        label="What are you saving for?"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Emergency Fund"
      />

      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
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
      ) : (
        <TextField
          label="Target amount"
          value={manualTarget}
          onChangeText={setManualTarget}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      )}

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
        label={isSubmitting ? 'Saving…' : 'Save goal'}
        onPress={handleSave}
        disabled={isSubmitting || !label.trim()}
      />
    </Screen>
  );
}
