import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { archiveSavingsGoal } from '@own-my-budget/api';
import { formatCents, type GoalStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ActivitySection } from '@/components/savings/activity-section';
import { BadgeTile } from '@/components/savings/badge-tile';
import { ChallengeDetails } from '@/components/savings/challenge-details';
import { confirmAction } from '@/components/savings/confirm';
import { CountTile } from '@/components/savings/count-tile';
import { EmergencyFundSection } from '@/components/savings/emergency-fund-section';
import { GoalDetails } from '@/components/savings/goal-details';
import { MissionRow } from '@/components/savings/mission-row';
import {
  useSavingsData,
  type ChallengeView,
  type GoalView,
} from '@/components/savings/use-savings-data';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { GoalCard } from '@/components/ui/goal-card';
import { Grid } from '@/components/ui/grid';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import type { StatusTone } from '@/components/ui/status-pill';
import { SubsectionHeader } from '@/components/ui/subsection-header';
import { Space } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';
import { GoalAssets } from '@/design-system/assets/goals';
import { supabase } from '@/lib/supabase';

const STATUS_LABEL: Record<GoalStatus, { label: string; tone: StatusTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  onTrack: { label: 'On track', tone: 'success' },
  // Calm amber, never red — being behind pace is a nudge, not a failure.
  behind: { label: 'A little behind', tone: 'warning' },
  inProgress: { label: 'In progress', tone: 'neutral' },
  notStarted: { label: 'Not started', tone: 'neutral' },
};

function illustrationFor(goal: GoalView) {
  if (goal.category === 'Emergency Fund') return GoalAssets.emergencyFund;
  if (goal.category === 'Vacation') return GoalAssets.familyVacation;
  if (goal.category === 'Major Purchase') return GoalAssets.newLaptop;
  return undefined;
}

export default function MoneyScreen() {
  const data = useSavingsData();
  const { refresh, isGuest } = data;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  /** Guests explore sample data only; any change nudges them toward an account. */
  const signUp = () => router.push('/sign-up');

  const openActivity = (
    goalId: string,
    kind: 'deposit' | 'withdrawal',
    prefill?: { amountCents: number; note: string }
  ) => {
    if (isGuest) return signUp();
    router.push({
      pathname: '/add-goal-activity',
      params: {
        goalId,
        kind,
        ...(prefill ? { amountCents: String(prefill.amountCents), note: prefill.note } : {}),
      },
    });
  };

  const openAddGoal = (preset?: 'emergency' | 'challenge') => {
    if (isGuest) return signUp();
    router.push(
      preset
        ? { pathname: '/add-savings-goal', params: { preset } }
        : { pathname: '/add-savings-goal' }
    );
  };

  const openEdit = (goalId: string) =>
    router.push({ pathname: '/add-savings-goal', params: { goalId } });

  const deleteGoal = (goal: { id: string; title: string }) =>
    confirmAction(
      'Delete this goal?',
      `"${goal.title}" will be removed from your goals. Its deposit history is kept.`,
      'Delete',
      async () => {
        try {
          await archiveSavingsGoal(supabase, goal.id, new Date().toISOString());
          setActionError(null);
          await refresh();
        } catch (error) {
          setActionError(error instanceof Error ? error.message : 'Could not delete that goal.');
        }
      }
    );

  const renderGoal = (goal: GoalView) => (
    <GoalCard
      title={goal.title}
      category={goal.category}
      savedCents={goal.savedCents}
      targetCents={goal.targetCents}
      percent={goal.percent}
      isComplete={goal.isComplete}
      remainingCents={goal.remainingCents}
      targetDate={goal.targetDate}
      status={STATUS_LABEL[goal.status]}
      illustration={illustrationFor(goal)}
      expanded={expandedId === goal.id}
      onToggleExpanded={() => toggle(goal.id)}
      details={
        <GoalDetails
          goal={goal}
          readOnly={isGuest}
          onEdit={() => openEdit(goal.id)}
          onDelete={() => deleteGoal(goal)}
        />
      }
      actions={
        <>
          <Button
            label={expandedId === goal.id ? 'Hide details' : 'View details'}
            variant="secondary"
            onPress={() => toggle(goal.id)}
            accessibilityLabel={`${expandedId === goal.id ? 'Hide' : 'View'} details for ${goal.title}`}
          />
          <Button
            label="Add deposit"
            onPress={() => openActivity(goal.id, 'deposit')}
            accessibilityLabel={`Add deposit to ${goal.title}`}
          />
          <Button
            label="Withdraw"
            variant="quiet"
            onPress={() => openActivity(goal.id, 'withdrawal')}
            accessibilityLabel={`Withdraw from ${goal.title}`}
          />
        </>
      }
    />
  );

  const renderChallenge = (challenge: ChallengeView) => {
    const cardKey = `challenge-${challenge.goalId}`;
    const finished = challenge.next === null;
    return (
      <GoalCard
        title={challenge.title}
        category={`Block ${Math.min(challenge.blocksDone + 1, challenge.blocks.length)} of ${challenge.blocks.length} · ${challenge.weeksDone} of ${challenge.totalWeeks} weeks`}
        savedCents={challenge.savedCents}
        targetCents={challenge.targetCents}
        percent={challenge.percent}
        isComplete={finished}
        expanded={expandedId === cardKey}
        onToggleExpanded={() => toggle(cardKey)}
        details={
          <ChallengeDetails
            challenge={challenge}
            readOnly={isGuest}
            onEdit={() => openEdit(challenge.goalId)}
          />
        }
        actions={
          <>
            {challenge.next ? (
              <Button
                label={`Log week ${challenge.next.week} (${formatCents(challenge.next.dueCents)})`}
                onPress={() =>
                  openActivity(challenge.goalId, 'deposit', {
                    amountCents: challenge.next!.dueCents,
                    note: `Week ${challenge.next!.week}`,
                  })
                }
              />
            ) : null}
            <Button
              label={expandedId === cardKey ? 'Hide details' : 'View details'}
              variant="secondary"
              onPress={() => toggle(cardKey)}
              accessibilityLabel={`${expandedId === cardKey ? 'Hide' : 'View'} details for ${challenge.title}`}
            />
            <Button
              label="Withdraw"
              variant="quiet"
              onPress={() => openActivity(challenge.goalId, 'withdrawal')}
              accessibilityLabel={`Withdraw from ${challenge.title}`}
            />
          </>
        }
      />
    );
  };

  const { summary, monthly } = data;
  const activeCards = data.challenges.length + data.regularGoals.length;
  const hasNoGoals = data.goals.length === 0 && data.challenges.length === 0;

  const monthlyValue =
    monthly.thisMonthCents > 0
      ? `+${formatCents(monthly.thisMonthCents)}`
      : formatCents(monthly.thisMonthCents);
  const monthlyNote =
    monthly.thisMonthCents <= 0
      ? monthly.hasLastMonth
        ? 'No deposits yet this month'
        : 'No previous month to compare'
      : monthly.percentChange !== null
        ? `${monthly.percentChange >= 0 ? '+' : ''}${monthly.percentChange}% vs last month`
        : monthly.hasLastMonth
          ? 'First deposits this month'
          : 'No previous month to compare';

  return (
    <Screen showGuestBanner>
      <ScreenHeader
        title="Savings & Goals"
        subtitle="Track your savings, build better habits, and reach your goals."
        action={<Button label="+ New goal" onPress={() => openAddGoal()} />}
      />

      {data.errorMessage ? (
        <Card style={{ gap: Space[2] }}>
          <ThemedText type="smallBold">We couldn&rsquo;t load all of your savings</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data.errorMessage}
          </ThemedText>
          <Button label="Try again" variant="secondary" onPress={refresh} />
        </Card>
      ) : null}

      {actionError ? (
        <Card>
          <ThemedText type="small" themeColor="danger">
            {actionError}
          </ThemedText>
        </Card>
      ) : null}

      {data.freshBadges.length > 0 ? (
        <Card
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[4] }}
        >
          <Image
            source={BrandAssets.mascotTransparent}
            style={{ width: 72, height: 72 }}
            contentFit="contain"
            accessibilityLabel=""
          />
          <View style={{ flexShrink: 1, gap: Space[1] }}>
            <ThemedText type="subtitle">
              {data.freshBadges.length === 1
                ? 'You earned a new badge!'
                : `You earned ${data.freshBadges.length} new badges!`}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {data.freshBadges.map((b) => b.name).join(', ')} — nice work. Keep it going.
            </ThemedText>
          </View>
        </Card>
      ) : null}

      <Grid>
        <StatTile
          label="Total Saved"
          valueCents={summary.totalSavedCents}
          glyph="$"
          glyphColor="success"
          glyphTint="successMuted"
          description={
            summary.totalSavedCents > 0
              ? `Across ${data.goals.length + data.challenges.length} ${
                  data.goals.length + data.challenges.length === 1 ? 'goal' : 'goals'
                }.`
              : 'Your first deposit will show up here.'
          }
          emphasize
        />
        <CountTile
          label="Monthly Savings"
          value={monthlyValue}
          description={monthlyNote}
          glyph="↗"
          valueColor={monthly.thisMonthCents > 0 ? 'success' : undefined}
        />
        <CountTile
          label="Badges Earned"
          value={`${data.badgesEarnedCount} ${data.badgesEarnedCount === 1 ? 'Badge' : 'Badges'}`}
          description={
            data.badgesEarnedCount > 0
              ? 'Great progress — keep going!'
              : 'Keep saving to unlock more.'
          }
          glyph="★"
          glyphColor="accent"
          glyphTint="accentMuted"
        />
      </Grid>

      <SectionCard title="Savings Summary">
        <Grid gap={Space[4]}>
          <SummaryItem label="Total savings" value={formatCents(summary.totalSavedCents)} />
          <SummaryItem label="52-week total" value={formatCents(summary.challengeSavedCents)} />
          <SummaryItem label="Emergency goals" value={formatCents(summary.emergencySavedCents)} />
          <SummaryItem label="Active goals" value={String(summary.activeGoalCount)} />
          <SummaryItem label="Completed" value={String(summary.completedGoalCount)} />
          <SummaryItem label="Badges" value={String(data.badgesEarnedCount)} />
        </Grid>
      </SectionCard>

      <EmergencyFundSection
        goals={data.emergencyGoals}
        renderGoal={renderGoal}
        onStart={() => openAddGoal('emergency')}
      />

      <View style={{ gap: Space[3] }}>
        <SubsectionHeader title="Active savings goals" />
        {hasNoGoals && !data.isLoading ? (
          <EmptyState
            title="No savings goals yet"
            message="Set a goal for something you care about, or try the 52-week challenge — small, steady deposits add up."
            action={
              <View style={{ gap: Space[2] }}>
                <Button label="+ New goal" variant="panel" onPress={() => openAddGoal()} />
                <Button
                  label="Start a 52-week challenge"
                  variant="secondary"
                  onPress={() => openAddGoal('challenge')}
                />
              </View>
            }
          />
        ) : activeCards > 0 ? (
          <Grid>
            {data.challenges.map((challenge) => (
              <View
                key={`challenge-${challenge.goalId}`}
                style={{ flexGrow: 1, flexBasis: 320, minWidth: 0, alignSelf: 'flex-start' }}
              >
                {renderChallenge(challenge)}
              </View>
            ))}
            {data.regularGoals.map((goal) => (
              <View
                key={goal.id}
                style={{ flexGrow: 1, flexBasis: 320, minWidth: 0, alignSelf: 'flex-start' }}
              >
                {renderGoal(goal)}
              </View>
            ))}
          </Grid>
        ) : data.isLoading ? (
          <ThemedText themeColor="textSecondary">Loading your goals…</ThemedText>
        ) : (
          <ThemedText themeColor="textSecondary">
            Your emergency fund is shown above. Add another goal whenever you&rsquo;re ready.
          </ThemedText>
        )}
      </View>

      <ActivitySection activity={data.activity} />

      <SectionCard
        title="Badge Earnings"
        action={
          <ThemedText type="smallBold" themeColor="textSecondary">
            {data.badgesEarnedCount} unlocked
          </ThemedText>
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
          {data.badges.map((badge) => (
            <BadgeTile
              key={badge.id}
              badge={badge}
              expanded={openBadgeId === badge.id}
              onToggle={() => setOpenBadgeId((current) => (current === badge.id ? null : badge.id))}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Budget missions">
        <View style={{ gap: Space[5] }}>
          {data.missions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              disabled={isGuest}
              onComplete={() => data.markMissionComplete(mission.id)}
            />
          ))}
        </View>
      </SectionCard>
    </Screen>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 140, gap: Space[1] }}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="amountSmall">{value}</ThemedText>
    </View>
  );
}
