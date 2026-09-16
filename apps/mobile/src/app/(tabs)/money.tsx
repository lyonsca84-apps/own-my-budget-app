import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { listSavingsGoals, type Tables } from '@own-my-budget/api';
import { calculateSavingsProgress } from '@own-my-budget/core';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { GoalCard } from '@/components/ui/goal-card';
import { GuestGate } from '@/components/ui/guest-gate';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { GoalAssets, type GoalAssetName } from '@/design-system/assets/goals';

const GOAL_ILLUSTRATION: Record<string, GoalAssetName> = {
  'emergency fund': 'emergencyFund',
  'family vacation': 'familyVacation',
  'new laptop': 'newLaptop',
};

function goalIllustrationFor(label: string) {
  const key = Object.keys(GOAL_ILLUSTRATION).find((k) => label.toLowerCase().includes(k));
  return key ? GoalAssets[GOAL_ILLUSTRATION[key]] : undefined;
}

export default function MoneyScreen() {
  const { status, user } = useAuth();
  const [goals, setGoals] = useState<Tables<'savings_goals'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    setGoals(await listSavingsGoals(supabase, user.id));
    setIsLoading(false);
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (status === 'guest') {
    return (
      <GuestGate
        title="Plan your savings goals"
        message="Guest mode shows sample data only. Create a free account to track your own savings goals."
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Savings & Goals"
        action={
          <Button
            label="+ Add goal"
            variant="secondary"
            onPress={() => router.push('/add-savings-goal')}
          />
        }
      />

      {!isLoading && goals.length === 0 && (
        <EmptyState
          title="No savings goals yet"
          message="Set your first goal — an emergency fund is a great start."
          mascot
        />
      )}

      {goals.map((goal) => {
        const progress = calculateSavingsProgress(goal.saved_cents, goal.target_cents);
        return (
          <GoalCard
            key={goal.id}
            title={goal.label}
            savedCents={goal.saved_cents}
            targetCents={goal.target_cents}
            percent={progress.percent}
            isComplete={progress.isComplete}
            targetDate={goal.target_date}
            illustration={goalIllustrationFor(goal.label)}
            actions={
              <>
                <Button
                  label="Add deposit"
                  onPress={() =>
                    router.push({
                      pathname: '/add-goal-activity',
                      params: { goalId: goal.id, kind: 'deposit' },
                    })
                  }
                />
                <Button
                  label="Withdraw"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/add-goal-activity',
                      params: { goalId: goal.id, kind: 'withdrawal' },
                    })
                  }
                />
              </>
            }
          />
        );
      })}
    </Screen>
  );
}
