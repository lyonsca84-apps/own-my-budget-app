import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  saveOnboardingIncomeSources,
  getProfile,
  listIncomeSources,
  updateProfile,
} from '@own-my-budget/api';
import {
  buildOnboardingSavePlan,
  newOnboardingIncomeId,
  parseOnboardingDraft,
  type OnboardingDraft,
  type OnboardingStep,
  type OnboardingHelpTopic,
  emptyIncomeDraft,
  explainMonthlyIncome,
  formatCents,
  formatLocalDate,
  hasIncomeDraftErrors,
  needsPayDateForMonthlyTotal,
  ONBOARDING_NAME_MAX_LENGTH,
  parseLocalDate,
  parseOnboardingAmount,
  validateIncomeDraft,
  type OnboardingIncomeDraft,
  type OnboardingPayFrequency,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { BrandAssets } from '@/design-system/assets/brand';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type StepId = OnboardingStep;
const draftKey = (userId: string) => `own-my-budget:onboarding-draft:${userId}`;

/** Steps that count toward the progress bar. Welcome and Done sit outside it. */
const INTERVIEW_STEPS: StepId[] = ['name', 'help', 'incomeChoice', 'income', 'review'];

const FREQUENCY_OPTIONS: { value: OnboardingPayFrequency; label: string; hint: string }[] = [
  { value: 'weekly', label: 'Every week', hint: 'Often hourly or shift work' },
  { value: 'biweekly', label: 'Every two weeks', hint: 'Usually on the same weekday' },
  { value: 'twice_monthly', label: 'Twice a month', hint: 'Like the 1st and the 15th' },
  { value: 'monthly', label: 'Once a month', hint: 'Same day each month' },
  { value: 'irregular', label: 'It changes', hint: 'Gig work, tips, or an uneven schedule' },
];

const FREQUENCY_PHRASE: Record<OnboardingPayFrequency, string> = {
  weekly: 'every week',
  biweekly: 'every two weeks',
  twice_monthly: 'twice a month',
  monthly: 'once a month',
  irregular: 'a month (your estimate)',
};

type HelpTopic = OnboardingHelpTopic;

const HELP_TOPICS: { key: HelpTopic; label: string }[] = [
  { key: 'bills', label: 'Keeping bills on track' },
  { key: 'paychecks', label: 'Making my paycheck stretch' },
  { key: 'spending', label: 'Planning my spending' },
  { key: 'debt', label: 'Paying down debt' },
  { key: 'saving', label: 'Saving money' },
  { key: 'basics', label: 'Learning budgeting basics' },
];

/** Next steps for the finish screen. Picked help topics move to the top; nothing else changes. */
const NEXT_STEPS: { topic: HelpTopic; text: string }[] = [
  { topic: 'bills', text: 'Add your bills so you can see what’s due and when.' },
  { topic: 'paychecks', text: 'Plan each paycheck on the Budget tab.' },
  { topic: 'spending', text: 'Set spending amounts for groceries and other categories.' },
  { topic: 'debt', text: 'Add a debt to see a payoff plan.' },
  { topic: 'saving', text: 'Start a savings goal, even a small one.' },
  { topic: 'basics', text: 'Tap the help icons on the dashboard to learn what each number means.' },
];

function formatPayday(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function describeEntered(draft: OnboardingIncomeDraft): string {
  const cents = parseOnboardingAmount(draft.amountText);
  if (!draft.frequency || typeof cents !== 'number') return 'Not finished';
  const amount = `${formatCents(cents)} ${FREQUENCY_PHRASE[draft.frequency]}`;
  const payday =
    draft.frequency !== 'irregular' && draft.nextPayDate
      ? `, next payday ${formatPayday(draft.nextPayDate)}`
      : '';
  return amount + payday;
}

/**
 * First-run interview every new account is routed to by the root navigator
 * (`status === 'needsOnboarding'`). It asks only for what personalizes the
 * profile and fills the Dashboard's income figure; everything else is left
 * blank for the Dashboard's "Finish setting up your budget" card.
 *
 * Answers stay in a temporary, per-user device draft until review is confirmed.
 * Stable row IDs let a failed save be retried without duplicating income.
 * Skipped answers are never stored as zeros.
 */
export default function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const today = useMemo(() => new Date(), []);

  const [step, setStep] = useState<StepId>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [existingDisplayName, setExistingDisplayName] = useState('');
  const [existingIncomeCount, setExistingIncomeCount] = useState(0);
  const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
  const [wantsIncome, setWantsIncome] = useState<boolean | null>(null);
  const [incomes, setIncomes] = useState<OnboardingIncomeDraft[]>([emptyIncomeDraft()]);
  const [activeIncome, setActiveIncome] = useState(0);
  const [showIncomeErrors, setShowIncomeErrors] = useState(false);

  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const incomeIds = useRef<string[] | null>(null);
  const saveInFlight = useRef(false);
  const [hasPartialSave, setHasPartialSave] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draftStorageError, setDraftStorageError] = useState(false);
  // Serialize writes so an older draft cannot replace a newer one or reappear after clearing.
  const draftWrites = useRef<Promise<void>>(Promise.resolve());

  function writeDraft(value: OnboardingDraft): Promise<void> {
    if (!user) return Promise.reject(new Error('No signed-in user'));
    const key = draftKey(user.id);
    const write = draftWrites.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
    draftWrites.current = write;
    return write;
  }

  async function clearDraft() {
    if (!user) return;
    await draftWrites.current.catch(() => {});
    await AsyncStorage.removeItem(draftKey(user.id));
  }

  // Prefill from an existing profile so a returning account isn't overwritten or duplicated.
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    Promise.all([
      getProfile(supabase, user.id),
      listIncomeSources(supabase, user.id),
      AsyncStorage.getItem(draftKey(user.id)),
    ])
      .then(([profile, sources, rawDraft]) => {
        if (!isMounted) return;
        const name = profile.display_name?.trim() ?? '';
        // 'there' is the column default ("Hi there"), not a name the user chose.
        const chosen = name && name !== 'there' ? name : '';
        setExistingDisplayName(chosen);
        const recovered = parseOnboardingDraft(rawDraft);
        setDisplayName(recovered?.displayName ?? chosen);
        setExistingIncomeCount(sources.filter((s) => s.archived_at === null).length);
        if (recovered) {
          setStep(recovered.step);
          setHelpTopics(recovered.helpTopics);
          setWantsIncome(recovered.wantsIncome);
          setIncomes(recovered.incomes);
          setActiveIncome(recovered.activeIncome);
          incomeIds.current = recovered.incomeIds;
          setHasPartialSave(recovered.incomeIds !== null);
        }
        setDraftLoaded(true);
      })
      .catch(() => {
        // Do not save a new name or income over account data we could not load.
        if (isMounted) setErrorMessage('We couldn’t load your setup. Please try again.');
      });
    return () => {
      isMounted = false;
    };
  }, [user, loadAttempt]);

  useEffect(() => {
    if (!draftLoaded || !user || isBusy || step === 'done') return;
    void writeDraft({
      version: 1,
      step,
      displayName,
      helpTopics,
      wantsIncome,
      incomes,
      activeIncome,
      incomeIds: incomeIds.current,
    })
      .then(() => setDraftStorageError(false))
      .catch(() => setDraftStorageError(true));
    // writeDraft uses only the current user and a stable write queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftLoaded,
    user,
    isBusy,
    step,
    displayName,
    helpTopics,
    wantsIncome,
    incomes,
    activeIncome,
  ]);

  const savedIncomes = wantsIncome ? incomes : [];
  const draft = incomes[activeIncome] ?? emptyIncomeDraft();
  const draftErrors = validateIncomeDraft(draft, today);
  const visibleErrors = showIncomeErrors ? draftErrors : {};

  function goTo(next: StepId) {
    setErrorMessage(null);
    setStep(next);
  }

  function goBack() {
    if (isBusy || hasPartialSave) return;
    if (step === 'review' && !wantsIncome) return goTo('incomeChoice');
    const order: StepId[] = ['welcome', ...INTERVIEW_STEPS];
    const index = order.indexOf(step);
    if (index > 0) goTo(order[index - 1]);
  }

  function updateDraft(patch: Partial<OnboardingIncomeDraft>) {
    setIncomes((current) =>
      current.map((entry, index) => (index === activeIncome ? { ...entry, ...patch } : entry))
    );
  }

  /** True when the income being edited is complete; otherwise shows its errors. */
  function checkDraft(): boolean {
    if (hasIncomeDraftErrors(draftErrors)) {
      setShowIncomeErrors(true);
      return false;
    }
    setShowIncomeErrors(false);
    return true;
  }

  function finishIncome() {
    if (checkDraft()) goTo('review');
  }

  function addAnotherIncome() {
    if (!checkDraft()) return;
    setIncomes((current) => [...current, emptyIncomeDraft()]);
    setActiveIncome(incomes.length);
  }

  function removeIncome(index: number) {
    setShowIncomeErrors(false);
    const next = incomes.filter((_, i) => i !== index);
    setIncomes(next.length > 0 ? next : [emptyIncomeDraft()]);
    setActiveIncome((current) => {
      const shifted = index < current ? current - 1 : current;
      return Math.max(0, Math.min(shifted, next.length - 1));
    });
  }

  function skipIncome() {
    setShowIncomeErrors(false);
    setWantsIncome(false);
    goTo('review');
  }

  async function handleDoLater() {
    if (saveInFlight.current || !draftLoaded) return;
    saveInFlight.current = true;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await clearDraft();
      await completeOnboarding();
    } catch {
      setErrorMessage('We couldn’t reach your account just now. Please try again.');
      setIsBusy(false);
    } finally {
      saveInFlight.current = false;
    }
  }

  async function handleSave() {
    if (!user || saveInFlight.current || !draftLoaded) return;
    // Validate every source, including previously edited entries, before writing anything.
    const invalid = savedIncomes.findIndex((entry) =>
      hasIncomeDraftErrors(validateIncomeDraft(entry, today))
    );
    if (invalid >= 0 && incomeIds.current === null) {
      setActiveIncome(invalid);
      setShowIncomeErrors(true);
      goTo('income');
      return;
    }
    saveInFlight.current = true;
    setIsBusy(true);
    setErrorMessage(null);
    const plan = buildOnboardingSavePlan({
      displayName,
      existingDisplayName,
      incomes: savedIncomes,
    });
    try {
      const ids = incomeIds.current ?? plan.incomeRows.map(() => newOnboardingIncomeId());
      // Persist the immutable review and its row IDs BEFORE contacting the database.
      // If storage fails, nothing is sent and the user can safely retry.
      await writeDraft({
        version: 1,
        step: 'review',
        displayName,
        helpTopics,
        wantsIncome,
        incomes,
        activeIncome,
        incomeIds: ids,
      });
      incomeIds.current = ids;
      setHasPartialSave(true);
      await saveOnboardingIncomeSources(
        supabase,
        user.id,
        plan.incomeRows.map((row, index) => ({ ...row, id: ids[index] }))
      );
      await updateProfile(supabase, user.id, {
        ...(plan.displayName ? { display_name: plan.displayName } : {}),
        onboarding_completed_at: new Date().toISOString(),
      });
      await clearDraft();
      setIsBusy(false);
      goTo('done');
    } catch {
      setErrorMessage(
        'We couldn’t save just now. Your answers are still here. Please try again in a moment.'
      );
      setIsBusy(false);
    } finally {
      saveInFlight.current = false;
    }
  }

  async function handleGoToDashboard() {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setIsBusy(true);
    try {
      await clearDraft();
      await completeOnboarding();
    } catch {
      setErrorMessage('We couldn’t open your dashboard just now. Please try again.');
      setIsBusy(false);
    } finally {
      saveInFlight.current = false;
    }
  }

  const progressIndex = INTERVIEW_STEPS.indexOf(step);

  if (!draftLoaded) {
    return (
      <Screen contentStyle={{ maxWidth: 600 }}>
        <ThemedText accessibilityRole={errorMessage ? 'alert' : undefined}>
          {errorMessage ?? 'Loading your setup…'}
        </ThemedText>
        {errorMessage ? (
          <Button
            label="Try again"
            onPress={() => {
              setErrorMessage(null);
              setLoadAttempt((n) => n + 1);
            }}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen key={step} contentStyle={{ maxWidth: 600, gap: Space[7] }}>
      {progressIndex >= 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[4] }}>
          <IconButton
            accessibilityLabel="Back"
            onPress={goBack}
            disabled={isBusy || hasPartialSave}
          >
            <ThemedText style={{ fontSize: 20, lineHeight: 22 }}>←</ThemedText>
          </IconButton>
          <View
            style={{ flex: 1 }}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${progressIndex + 1} of ${INTERVIEW_STEPS.length}`}
          >
            <ProgressBar percent={((progressIndex + 1) / INTERVIEW_STEPS.length) * 100} />
          </View>
        </View>
      ) : null}

      {draftStorageError ? (
        <ThemedText type="small" themeColor="warning" accessibilityRole="alert">
          We couldn’t keep your draft on this device. Keep this screen open and try again before
          saving.
        </ThemedText>
      ) : null}

      {step === 'welcome' && (
        <View style={{ gap: Space[7], alignItems: 'center', paddingTop: Space[7] }}>
          <Image
            source={BrandAssets.horizontalLockup}
            style={{ width: 260, height: 120 }}
            contentFit="contain"
            accessibilityLabel="Own My Budget"
          />
          <View style={{ gap: Space[3], alignItems: 'center' }}>
            <ThemedText type="title" style={{ textAlign: 'center' }} accessibilityRole="header">
              Welcome to Own My Budget
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 460 }}>
              Answer a few quick questions and we&rsquo;ll set up a starting dashboard for you. It
              takes about two minutes.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 460 }}>
              You can skip anything. Bills, debts, and savings can be added later, whenever
              you&rsquo;re ready.
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Your answers are kept in a draft on this device so you can return here. They are added
            to your budget only when you choose Save and continue.
          </ThemedText>
          <View style={{ gap: Space[3], alignSelf: 'stretch' }}>
            <Button
              label="Get started"
              variant="panel"
              onPress={() => goTo('name')}
              disabled={isBusy}
            />
            <Button
              label="Do this later"
              variant="quiet"
              onPress={handleDoLater}
              loading={isBusy}
            />
          </View>
          {errorMessage ? (
            <ThemedText
              type="small"
              themeColor="danger"
              accessibilityRole="alert"
              style={{ textAlign: 'center' }}
            >
              {errorMessage}
            </ThemedText>
          ) : null}
        </View>
      )}

      {step === 'name' && (
        <StepBody question="What name would you like to see in the app?">
          <TextField
            label="Your name (optional)"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Jamie"
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={ONBOARDING_NAME_MAX_LENGTH}
            helperText="A first name or nickname is fine. We use it to say hello."
            onSubmitEditing={() => goTo('help')}
            returnKeyType="next"
          />
          <StepActions
            primaryLabel="Continue"
            onPrimary={() => goTo('help')}
            secondaryLabel={displayName.trim() ? undefined : 'Skip for now'}
            onSecondary={() => {
              setDisplayName('');
              goTo('help');
            }}
          />
        </StepBody>
      )}

      {step === 'help' && (
        <StepBody
          question="What would you most like help with?"
          detail="Pick as many as you like, or skip. We use this to suggest your next steps."
        >
          <View style={{ gap: Space[3] }}>
            {HELP_TOPICS.map((topic) => (
              <OptionRow
                key={topic.key}
                label={topic.label}
                kind="checkbox"
                selected={helpTopics.includes(topic.key)}
                onPress={() =>
                  setHelpTopics((current) =>
                    current.includes(topic.key)
                      ? current.filter((k) => k !== topic.key)
                      : [...current, topic.key]
                  )
                }
              />
            ))}
          </View>
          <StepActions
            primaryLabel="Continue"
            onPrimary={() => goTo('incomeChoice')}
            secondaryLabel={helpTopics.length === 0 ? 'Skip for now' : undefined}
            onSecondary={() => goTo('incomeChoice')}
          />
        </StepBody>
      )}

      {step === 'incomeChoice' && (
        <StepBody
          question="Would you like to add your take-home pay now?"
          detail="Take-home pay is the money that reaches your account after taxes and other deductions. An estimate is fine."
        >
          {existingIncomeCount > 0 ? (
            <Card style={{ gap: Space[1] }}>
              <ThemedText type="smallBold">
                You already have {existingIncomeCount} income{' '}
                {existingIncomeCount === 1 ? 'source' : 'sources'} saved.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Anything you add here is added next to it. Nothing you saved is changed.
              </ThemedText>
            </Card>
          ) : null}
          <View style={{ gap: Space[3] }} accessibilityRole="radiogroup">
            <OptionRow
              label="Yes, add my pay"
              kind="radio"
              selected={wantsIncome === true}
              onPress={() => {
                setWantsIncome(true);
                goTo('income');
              }}
            />
            <OptionRow
              label="I’ll add this later"
              kind="radio"
              selected={wantsIncome === false}
              onPress={skipIncome}
            />
          </View>
        </StepBody>
      )}

      {step === 'income' && (
        <StepBody
          question={
            activeIncome === 0
              ? 'How often do you get paid?'
              : 'How often is this other income paid?'
          }
          detail="If more than one person earns money in your home, add only the income you want to track here."
        >
          {incomes.length > 1 ? (
            <View style={{ gap: Space[2] }}>
              {incomes.map((entry, index) =>
                index === activeIncome ? null : (
                  <Card
                    key={index}
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: Space[3],
                      padding: Space[4],
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 180, gap: Space[1] }}>
                      <ThemedText type="smallBold">
                        {entry.label.trim() || `Income ${index + 1}`}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {describeEntered(entry)}
                      </ThemedText>
                    </View>
                    <Button
                      label="Edit"
                      size="sm"
                      variant="soft"
                      onPress={() => {
                        if (checkDraft()) setActiveIncome(index);
                      }}
                      accessibilityLabel={`Edit income ${index + 1}`}
                    />
                    <Button
                      label="Remove"
                      size="sm"
                      variant="quiet"
                      onPress={() => removeIncome(index)}
                      accessibilityLabel={`Remove income ${index + 1}`}
                    />
                  </Card>
                )
              )}
            </View>
          ) : null}

          <View style={{ gap: Space[3] }} accessibilityRole="radiogroup">
            {FREQUENCY_OPTIONS.map((option) => (
              <OptionRow
                key={option.value}
                label={option.label}
                hint={option.hint}
                kind="radio"
                selected={draft.frequency === option.value}
                onPress={() => updateDraft({ frequency: option.value })}
              />
            ))}
            {visibleErrors.frequency ? (
              <ThemedText type="small" themeColor="danger">
                {visibleErrors.frequency}
              </ThemedText>
            ) : null}
          </View>

          {draft.frequency ? (
            <View style={{ gap: Space[5] }}>
              <TextField
                label={
                  draft.frequency === 'irregular'
                    ? 'About how much do you take home in a typical month?'
                    : 'How much do you take home each payday?'
                }
                value={draft.amountText}
                onChangeText={(text) => updateDraft({ amountText: text })}
                placeholder="0.00"
                keyboardType="decimal-pad"
                inputMode="decimal"
                errorMessage={visibleErrors.amount}
                helperText={
                  draft.frequency === 'irregular'
                    ? 'Your best guess is fine. You can change it anytime.'
                    : 'Use the amount after taxes and deductions. An estimate is fine.'
                }
              />

              {draft.frequency !== 'irregular' ? (
                <View style={{ gap: Space[2] }}>
                  <DateField
                    label={
                      needsPayDateForMonthlyTotal(draft.frequency)
                        ? 'When is your next payday?'
                        : 'When is your next payday? (optional)'
                    }
                    value={draft.nextPayDate}
                    onChange={(value) => updateDraft({ nextPayDate: value })}
                    min={formatLocalDate(today)}
                    errorMessage={visibleErrors.nextPayDate}
                  />
                  {!visibleErrors.nextPayDate ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {needsPayDateForMonthlyTotal(draft.frequency)
                        ? 'We use it to count how many paydays land in each month.'
                        : 'We use it for payday reminders. You can add it later.'}
                    </ThemedText>
                  ) : null}
                  {!needsPayDateForMonthlyTotal(draft.frequency) && draft.nextPayDate ? (
                    <Button
                      label="I’ll add this later"
                      variant="quiet"
                      onPress={() => updateDraft({ nextPayDate: '' })}
                      style={{ alignSelf: 'flex-start' }}
                    />
                  ) : null}
                </View>
              ) : null}

              <TextField
                label="Give this income a name (optional)"
                value={draft.label}
                onChangeText={(text) => updateDraft({ label: text })}
                placeholder="Main job"
                maxLength={60}
              />

              <MonthlyExplanation draft={draft} today={today} />
            </View>
          ) : null}

          <View style={{ gap: Space[3] }}>
            <Button label="Continue" variant="panel" onPress={finishIncome} />
            {draft.frequency ? (
              <Button label="Add another income" variant="outline" onPress={addAnotherIncome} />
            ) : null}
            <Button label="I’ll add income later" variant="quiet" onPress={skipIncome} />
          </View>
        </StepBody>
      )}

      {step === 'review' && (
        <StepBody
          question="Here’s what you told us."
          detail="Check your answers. They are added to your account when you choose “Save and continue.”"
        >
          <ReviewRow
            title="Your name"
            onEdit={isBusy || hasPartialSave ? undefined : () => goTo('name')}
          >
            <ThemedText>{displayName.trim() || 'Skipped'}</ThemedText>
          </ReviewRow>

          <ReviewRow
            title="Help with"
            onEdit={isBusy || hasPartialSave ? undefined : () => goTo('help')}
          >
            <ThemedText>
              {helpTopics.length > 0
                ? HELP_TOPICS.filter((t) => helpTopics.includes(t.key))
                    .map((t) => t.label)
                    .join(', ')
                : 'Skipped'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Used only for the next steps shown here. Kept in your device draft until you finish.
            </ThemedText>
          </ReviewRow>

          <ReviewRow
            title="Take-home pay"
            onEdit={
              isBusy || hasPartialSave
                ? undefined
                : () => {
                    if (wantsIncome) {
                      setActiveIncome(0);
                      goTo('income');
                    } else {
                      goTo('incomeChoice');
                    }
                  }
            }
          >
            {savedIncomes.length === 0 ? (
              <ThemedText>Skipped. You can add it from your dashboard anytime.</ThemedText>
            ) : (
              savedIncomes.map((entry, index) => (
                <View key={index} style={{ gap: Space[1] }}>
                  {savedIncomes.length > 1 ? (
                    <ThemedText type="smallBold">
                      {entry.label.trim() || `Income ${index + 1}`}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="smallBold">You entered</ThemedText>
                  <ThemedText>{describeEntered(entry)}</ThemedText>
                  <MonthlyExplanation draft={entry} today={today} compact />
                </View>
              ))
            )}
          </ReviewRow>

          <Card style={{ gap: Space[2] }}>
            <ThemedText type="smallBold">For later</ThemedText>
            <ThemedText themeColor="textSecondary">
              Bills, spending, debts, and savings goals stay blank for now. Your dashboard will show
              you where to add them when you&rsquo;re ready.
            </ThemedText>
          </Card>

          <ThemedText type="small" themeColor="textSecondary">
            We save these answers to your Own My Budget account. You can export or delete your data
            anytime in Settings, under Data &amp; privacy. Own My Budget provides educational
            budgeting tools and general information.
          </ThemedText>

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {errorMessage}
            </ThemedText>
          ) : null}

          {hasPartialSave ? (
            <ThemedText type="small" themeColor="textSecondary">
              Your save has started. Retry to finish safely; income already saved won’t be added
              again. You can edit saved details from your dashboard afterward.
            </ThemedText>
          ) : null}

          <Button label="Save and continue" variant="panel" onPress={handleSave} loading={isBusy} />
        </StepBody>
      )}

      {step === 'done' && (
        <View style={{ gap: Space[7], alignItems: 'center', paddingTop: Space[7] }}>
          <Image
            source={BrandAssets.mascotTransparent}
            style={{ width: 140, height: 140 }}
            contentFit="contain"
          />
          <View style={{ gap: Space[3], alignItems: 'center' }}>
            <ThemedText type="title" style={{ textAlign: 'center' }} accessibilityRole="header">
              {displayName.trim() ? `Nice work, ${displayName.trim()}!` : 'Nice work!'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 460 }}>
              Your starting dashboard is ready. You took a real first step today.
            </ThemedText>
          </View>
          <Card style={{ gap: Space[3], alignSelf: 'stretch' }}>
            <ThemedText type="smallBold">Good next steps, when you&rsquo;re ready</ThemedText>
            {[...NEXT_STEPS]
              .sort(
                (a, b) =>
                  Number(helpTopics.includes(b.topic)) - Number(helpTopics.includes(a.topic))
              )
              .slice(0, 3)
              .map((item) => (
                <View key={item.topic} style={{ flexDirection: 'row', gap: Space[2] }}>
                  <ThemedText themeColor="primary">•</ThemedText>
                  <ThemedText style={{ flex: 1 }}>{item.text}</ThemedText>
                </View>
              ))}
          </Card>
          {errorMessage ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {errorMessage}
            </ThemedText>
          ) : null}
          <Button
            label="Go to my dashboard"
            variant="panel"
            onPress={handleGoToDashboard}
            loading={isBusy}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}
    </Screen>
  );
}

/** Mascot + speech-bubble question, then the step's fields. */
function StepBody({
  question,
  detail,
  children,
}: {
  question: string;
  detail?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: Space[5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[3] }}>
        <Image
          source={BrandAssets.mascotTransparent}
          style={{ width: 72, height: 72 }}
          contentFit="contain"
        />
        <View
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
            borderRadius: Radius.smallCard,
            paddingVertical: Space[3],
            paddingHorizontal: Space[4],
          }}
        >
          <ThemedText type="subtitle" accessibilityRole="header">
            {question}
          </ThemedText>
        </View>
      </View>
      {detail ? <ThemedText themeColor="textSecondary">{detail}</ThemedText> : null}
      {children}
    </View>
  );
}

function StepActions({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={{ gap: Space[3] }}>
      <Button label={primaryLabel} variant="panel" onPress={onPrimary} />
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} variant="quiet" onPress={onSecondary} />
      ) : null}
    </View>
  );
}

/** A large tappable choice row — a checkbox (multi-select) or a radio (single choice). */
function OptionRow({
  label,
  hint,
  kind,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  kind: 'checkbox' | 'radio';
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space[4],
        minHeight: Layout.controlHeight + 8,
        paddingVertical: Space[3],
        paddingHorizontal: Space[4],
        borderRadius: Radius.smallCard,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? theme.primary : theme.controlBorder,
        backgroundColor: selected ? theme.primaryMuted : theme.backgroundElement,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold" style={{ fontSize: 17 }}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: kind === 'radio' ? Radius.full : 6,
          borderWidth: 1.5,
          borderColor: selected ? theme.primary : theme.controlBorder,
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <ThemedText style={{ color: theme.onPrimary, fontSize: 14, lineHeight: 16 }}>
            ✓
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function ReviewRow({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <Card style={{ gap: Space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {onEdit ? (
          <Button
            label="Edit"
            size="sm"
            variant="quiet"
            onPress={onEdit}
            accessibilityLabel={`Edit ${title.toLowerCase()}`}
          />
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** Shows how a monthly income figure is reached, labeled as calculated or as the user's estimate. */
function MonthlyExplanation({
  draft,
  today,
  compact,
}: {
  draft: OnboardingIncomeDraft;
  today: Date;
  compact?: boolean;
}) {
  const theme = useTheme();
  const result = explainMonthlyIncome(draft, today.getFullYear(), today.getMonth());
  if (result.kind === 'unknown' && !compact) return null;
  const heading =
    result.kind === 'calculated'
      ? 'Calculated by the app'
      : result.kind === 'estimate'
        ? 'Your monthly estimate'
        : 'Monthly total';
  return (
    <View
      style={{
        gap: Space[1],
        padding: compact ? 0 : Space[4],
        borderRadius: Radius.input,
        backgroundColor: compact ? 'transparent' : theme.backgroundSelected,
      }}
    >
      <ThemedText type="smallBold">{heading}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {result.text}
      </ThemedText>
    </View>
  );
}
