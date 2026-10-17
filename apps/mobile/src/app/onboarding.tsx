import { useState } from 'react';
import { View } from 'react-native';
import {
  createAccount,
  createCategory,
  createIncomeSource,
  createSavingsGoal,
  getOrCreateBudgetPeriod,
  updateProfile,
  upsertBudgetLine,
  type Database,
} from '@own-my-budget/api';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OnboardingStepper } from '@/components/ui/onboarding-stepper';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

type Frequency = Database['public']['Tables']['income_sources']['Row']['frequency'];
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'twice_monthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'variable', label: 'Variable' },
];

type CategoryType = Database['public']['Tables']['categories']['Row']['type'];
interface PresetCategory {
  key: string;
  label: string;
  type: CategoryType;
}
const PRESET_CATEGORIES: PresetCategory[] = [
  { key: 'housing', label: 'Housing', type: 'bill' },
  { key: 'groceries', label: 'Groceries', type: 'groceries' },
  { key: 'transportation', label: 'Transportation', type: 'bill' },
  { key: 'subscriptions', label: 'Subscriptions', type: 'bill' },
  { key: 'fun', label: 'Fun money', type: 'allowance' },
  { key: 'debt', label: 'Debt payments', type: 'debt' },
];

const STEP_LABELS = ['You', 'Money in', 'Budget', 'Goals', 'Done'];

/** Parses a currency-style string into cents; null if it isn't a valid non-negative amount. */
function parseAmountToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cents = Math.round(parseFloat(trimmed) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
}

/**
 * The wizard every new account is routed through by the root navigator
 * (`status === 'needsOnboarding'`) until `completeOnboarding()` is called.
 * Nothing is written to Supabase until the final step, so backing out with
 * the app killed mid-wizard just re-shows this screen next launch.
 */
export default function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);

  const [displayName, setDisplayName] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [incomeLabel, setIncomeLabel] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<Frequency>('biweekly');
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  const [categoryPlannedAmounts, setCategoryPlannedAmounts] = useState<Record<string, string>>({});
  const [goalLabel, setGoalLabel] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleCategory(key: string) {
    setSelectedCategoryKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  function validateStep(): string | null {
    if (step === 0 && !displayName.trim()) {
      return 'Tell us what to call you.';
    }
    if (step === 1) {
      if (parseAmountToCents(startingBalance) === null) {
        return 'Enter your current balance — 0 is fine.';
      }
      const hasLabel = incomeLabel.trim().length > 0;
      const hasAmount = incomeAmount.trim().length > 0;
      if (hasLabel !== hasAmount) {
        return 'Enter both an income source and its amount, or leave both blank.';
      }
      if (hasAmount && parseAmountToCents(incomeAmount) === null) {
        return 'Enter a valid income amount.';
      }
    }
    return null;
  }

  function handleNext() {
    const error = validateStep();
    if (error) {
      setErrorMessage(error);
      return;
    }
    setErrorMessage(null);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function handleBack() {
    setErrorMessage(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    if (!user) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updateProfile(supabase, user.id, { display_name: displayName.trim() });

      await createAccount(supabase, {
        user_id: user.id,
        label: 'Checking',
        type: 'checking',
        balance_cents: parseAmountToCents(startingBalance) ?? 0,
      });

      const incomeAmountCents = parseAmountToCents(incomeAmount);
      if (incomeLabel.trim() && incomeAmountCents !== null) {
        await createIncomeSource(supabase, {
          user_id: user.id,
          label: incomeLabel.trim(),
          amount_cents: incomeAmountCents,
          frequency: incomeFrequency,
        });
      }

      if (selectedCategoryKeys.length > 0) {
        const now = new Date();
        const periodStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
        const periodEnd = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const budgetPeriod = await getOrCreateBudgetPeriod(
          supabase,
          user.id,
          periodStart,
          periodEnd
        );

        for (const key of selectedCategoryKeys) {
          const preset = PRESET_CATEGORIES.find((c) => c.key === key);
          if (!preset) continue;
          const category = await createCategory(supabase, {
            user_id: user.id,
            name: preset.label,
            type: preset.type,
          });
          const plannedCents = parseAmountToCents(categoryPlannedAmounts[key] ?? '');
          if (plannedCents) {
            await upsertBudgetLine(supabase, {
              user_id: user.id,
              budget_period_id: budgetPeriod.id,
              category_id: category.id,
              planned_cents: plannedCents,
            });
          }
        }
      }

      const goalTargetCents = parseAmountToCents(goalTarget);
      if (goalLabel.trim() && goalTargetCents) {
        await createSavingsGoal(supabase, {
          user_id: user.id,
          label: goalLabel.trim(),
          target_cents: goalTargetCents,
        });
      }

      await completeOnboarding();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: Space[7] }}>
        <OnboardingStepper labels={STEP_LABELS} currentStep={step} />

        {step === 0 && (
          <View style={{ gap: Space[5] }}>
            <View style={{ gap: Space[2] }}>
              <ThemedText type="title">Welcome to Own My Budget</ThemedText>
              <ThemedText themeColor="textSecondary">
                Let&rsquo;s set up your account so your dashboard is ready with your own numbers.
              </ThemedText>
            </View>
            <TextField
              label="What should we call you?"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Jamie"
              autoCapitalize="words"
              autoFocus
            />
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: Space[5] }}>
            <View style={{ gap: Space[2] }}>
              <ThemedText type="title">Let&rsquo;s start with the numbers</ThemedText>
              <ThemedText themeColor="textSecondary">
                Your balance and income are the biggest inputs to your Budget Health Score.
              </ThemedText>
            </View>
            <TextField
              label="Current bank balance"
              value={startingBalance}
              onChangeText={setStartingBalance}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Card style={{ gap: Space[4] }}>
              <ThemedText type="smallBold">Income (optional)</ThemedText>
              <TextField
                label="Source"
                value={incomeLabel}
                onChangeText={setIncomeLabel}
                placeholder="e.g. Riverside Retail"
              />
              <TextField
                label="Amount per paycheck"
                value={incomeAmount}
                onChangeText={setIncomeAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <View style={{ gap: Space[1] }}>
                <ThemedText type="smallBold">Frequency</ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                  {FREQUENCIES.map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      variant={option.value === incomeFrequency ? 'primary' : 'secondary'}
                      onPress={() => setIncomeFrequency(option.value)}
                    />
                  ))}
                </View>
              </View>
            </Card>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: Space[5] }}>
            <View style={{ gap: Space[2] }}>
              <ThemedText type="title">Pick your budget categories</ThemedText>
              <ThemedText themeColor="textSecondary">
                Choose the ones you want to track — you can add more anytime.
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
              {PRESET_CATEGORIES.map((preset) => (
                <Button
                  key={preset.key}
                  label={preset.label}
                  variant={selectedCategoryKeys.includes(preset.key) ? 'primary' : 'secondary'}
                  onPress={() => toggleCategory(preset.key)}
                />
              ))}
            </View>
            {selectedCategoryKeys.length > 0 && (
              <Card style={{ gap: Space[4] }}>
                <ThemedText type="smallBold">Planned amount per month (optional)</ThemedText>
                {selectedCategoryKeys.map((key) => {
                  const preset = PRESET_CATEGORIES.find((c) => c.key === key);
                  if (!preset) return null;
                  return (
                    <TextField
                      key={key}
                      label={preset.label}
                      value={categoryPlannedAmounts[key] ?? ''}
                      onChangeText={(text) =>
                        setCategoryPlannedAmounts((current) => ({ ...current, [key]: text }))
                      }
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                  );
                })}
              </Card>
            )}
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: Space[5] }}>
            <View style={{ gap: Space[2] }}>
              <ThemedText type="title">Set a savings goal</ThemedText>
              <ThemedText themeColor="textSecondary">
                Optional, but it&rsquo;s the fastest way to stay motivated. You can skip this for
                now.
              </ThemedText>
            </View>
            <TextField
              label="Goal name"
              value={goalLabel}
              onChangeText={setGoalLabel}
              placeholder="Emergency fund"
            />
            <TextField
              label="Target amount"
              value={goalTarget}
              onChangeText={setGoalTarget}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: Space[5] }}>
            <View style={{ gap: Space[2] }}>
              <ThemedText type="title">You&rsquo;re all set, {displayName || 'there'}!</ThemedText>
              <ThemedText themeColor="textSecondary">
                Here&rsquo;s what we&rsquo;ll set up on your dashboard.
              </ThemedText>
            </View>
            <Card style={{ gap: Space[3] }}>
              <SummaryRow label="Name" value={displayName || '—'} />
              <SummaryRow label="Starting balance" value={`$${startingBalance || '0.00'}`} />
              <SummaryRow
                label="Income"
                value={incomeLabel.trim() ? `${incomeLabel} · $${incomeAmount}` : 'Skipped'}
              />
              <SummaryRow
                label="Budget categories"
                value={
                  selectedCategoryKeys.length > 0
                    ? selectedCategoryKeys
                        .map((key) => PRESET_CATEGORIES.find((c) => c.key === key)?.label)
                        .filter(Boolean)
                        .join(', ')
                    : 'Skipped'
                }
              />
              <SummaryRow
                label="Savings goal"
                value={goalLabel.trim() ? `${goalLabel} · $${goalTarget}` : 'Skipped'}
              />
            </Card>
          </View>
        )}

        {errorMessage ? (
          <ThemedText type="small" themeColor="danger">
            {errorMessage}
          </ThemedText>
        ) : null}

        <View
          style={{ flexDirection: 'row', justifyContent: step > 0 ? 'space-between' : 'flex-end' }}
        >
          {step > 0 && (
            <Button label="Back" variant="secondary" onPress={handleBack} disabled={isSubmitting} />
          )}
          {step < STEP_LABELS.length - 1 ? (
            <Button
              label={step === 3 && !goalLabel.trim() ? 'Skip for now' : 'Continue'}
              variant="panel"
              onPress={handleNext}
            />
          ) : (
            <Button
              label={isSubmitting ? 'Setting things up…' : 'Go to dashboard'}
              variant="panel"
              onPress={handleFinish}
              disabled={isSubmitting}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space[3] }}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}
