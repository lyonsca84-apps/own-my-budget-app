import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { type GoalStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ActivitySection } from '@/components/savings/activity-section';
import { BadgeTile } from '@/components/savings/badge-tile';
import { formatMoney } from '@/components/savings/format';
import { GoalDetails } from '@/components/savings/goal-details';
import { MissionRow } from '@/components/savings/mission-row';
import { StatCard } from '@/components/savings/stat-card';
import {
  useSavingsData,
  type ChallengeView,
  type GoalActivityView,
  type GoalView,
} from '@/components/savings/use-savings-data';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { GoalCard } from '@/components/ui/goal-card';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import type { StatusTone } from '@/components/ui/status-pill';
import { Brand, Fonts, Radius, Space } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';
import { useTheme } from '@/hooks/use-theme';

const STATUS_LABEL: Record<GoalStatus, { label: string; tone: StatusTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  onTrack: { label: 'On Track', tone: 'accent' },
  // Clay, not red: behind pace is a nudge, not a failure. The words carry the meaning too.
  behind: { label: 'Behind Schedule', tone: 'danger' },
  inProgress: { label: 'In Progress', tone: 'info' },
  notStarted: { label: 'Not Started', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'neutral' },
};

const GRID_GAP = Space[5];
const MIN_CARD_WIDTH = 290;

/** Lays cards out in equal columns (up to three, as in the design) so a lone last card keeps its column width. */
function CardGrid({ children }: { children: ReactNode[] }) {
  const [width, setWidth] = useState(0);
  const columns = width
    ? Math.max(1, Math.min(3, Math.floor((width + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP))))
    : 1;
  const cardWidth = width ? (width - GRID_GAP * (columns - 1)) / columns : undefined;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, alignItems: 'flex-start' }}
    >
      {children.map((child, index) => (
        <View key={index} style={{ width: cardWidth ?? '100%', minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export default function MoneyScreen() {
  const theme = useTheme();
  const data = useSavingsData();
  const { refresh } = data;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const toggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  const run = async (id: string, action: () => Promise<void>, fallback: string) => {
    try {
      await action();
      setActionError(null);
    } catch (error) {
      setActionError({ id, message: error instanceof Error ? error.message : fallback });
    }
  };

  const openDeposit = (goalId: string) =>
    router.push({ pathname: '/add-goal-activity', params: { goalId } });
  const openEditDeposit = (deposit: GoalActivityView) =>
    router.push({
      pathname: '/add-goal-activity',
      params: { goalId: deposit.goalId, activityId: deposit.id },
    });
  const openNewGoal = (preset?: 'challenge') =>
    router.push(
      preset
        ? { pathname: '/add-savings-goal', params: { preset } }
        : { pathname: '/add-savings-goal' }
    );
  const openEditGoal = (goalId: string) =>
    router.push({ pathname: '/add-savings-goal', params: { goalId } });
  const planPayment = (goal: GoalView) =>
    router.push({
      pathname: '/plan-payment',
      params: {
        targetType: 'savings_goal',
        targetId: goal.id,
        // Older builds of the dialog read kind / id.
        kind: 'savings_goal',
        id: goal.id,
        ...((goal.suggestedCents ?? goal.plannedDepositCents)
          ? { amount: String(goal.suggestedCents ?? goal.plannedDepositCents) }
          : {}),
      },
    });

  const renderGoal = (goal: GoalView) => {
    const expanded = expandedId === goal.id;
    return (
      <GoalCard
        title={goal.title}
        category={goal.category}
        savedCents={goal.savedCents}
        targetCents={goal.targetCents}
        percent={goal.percent}
        isComplete={goal.isComplete}
        remainingCents={goal.remainingCents}
        status={STATUS_LABEL[goal.status]}
        ringColor={goal.color}
        expanded={expanded}
        onToggleExpanded={() => toggle(goal.id)}
        details={
          <GoalDetails
            goal={goal}
            designSchema={data.capabilities.goalDesign}
            errorMessage={actionError?.id === goal.id ? actionError.message : null}
            onPlanPayment={() => planPayment(goal)}
            onEdit={() => openEditGoal(goal.id)}
            onTogglePause={() =>
              run(
                goal.id,
                () => data.setGoalPaused(goal.id, !goal.isPaused),
                'Could not update that goal.'
              )
            }
            onDelete={() =>
              run(goal.id, () => data.deleteGoal(goal.id), 'Could not delete that goal.')
            }
            onEditDeposit={openEditDeposit}
            onDeleteDeposit={(deposit) =>
              run(goal.id, () => data.deleteDeposit(deposit.id), 'Could not delete that entry.')
            }
          />
        }
        actions={
          <>
            <Button
              label={expanded ? 'Hide Details' : 'View Details'}
              variant="outline"
              shape="rounded"
              size="sm"
              style={{ flexGrow: 1, flexBasis: 110 }}
              onPress={() => toggle(goal.id)}
              aria-expanded={expanded}
              accessibilityLabel={`${expanded ? 'Hide' : 'View'} details for ${goal.title}`}
            />
            <Button
              label="Add Deposit"
              shape="rounded"
              size="sm"
              style={{ flexGrow: 1, flexBasis: 110 }}
              onPress={() => openDeposit(goal.id)}
              accessibilityLabel={`Add deposit to ${goal.title}`}
            />
          </>
        }
      />
    );
  };

  const renderChallenge = (challenge: ChallengeView) => {
    const cardKey = `challenge-${challenge.goalId}`;
    const expanded = expandedId === cardKey;
    return (
      <GoalCard
        title={challenge.title}
        category={`Block ${challenge.blocksDone} of ${challenge.blocks.length}`}
        savedLabel="Saved so far"
        savedCents={challenge.savedCents}
        targetCents={challenge.targetCents}
        percent={challenge.percent}
        isComplete={challenge.weeksDone >= challenge.totalWeeks}
        status={undefined}
        ringColor={challenge.color}
        expanded={expanded}
        onToggleExpanded={() => toggle(cardKey)}
        details={
          <View style={{ gap: Space[3] }}>
            <View style={{ height: 1, backgroundColor: theme.border }} />
            <View style={{ gap: Space[1] }}>
              <ThemedText type="small" themeColor="textSecondary">
                Week {challenge.currentWeek} of {challenge.totalWeeks} ·{' '}
                {challenge.cadence === 'biweekly' ? 'Biweekly' : 'Weekly'} deposits
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Start {shortDate(challenge.startDate)} · Ends {shortDate(challenge.endDate)}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.solidAccent }}>
                {challenge.blocksDone} of {challenge.blocks.length} blocks completed
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
              <Button
                label="Edit Challenge"
                variant="soft"
                size="sm"
                shape="rounded"
                onPress={() => openEditGoal(challenge.goalId)}
              />
            </View>
          </View>
        }
        actions={
          <Button
            label="View Details"
            shape="rounded"
            size="sm"
            style={{ flexGrow: 1 }}
            onPress={() =>
              router.push({ pathname: '/savings-challenge', params: { goalId: challenge.goalId } })
            }
            accessibilityLabel={`View details for ${challenge.title}`}
          />
        }
      />
    );
  };

  const { summary, monthly } = data;
  const goalCards = [
    ...data.challenges.map((challenge) => renderChallenge(challenge)),
    ...data.goals.map((goal) => renderGoal(goal)),
  ];
  const hasNoGoals = data.goals.length === 0 && data.challenges.length === 0;
  const anyBehind = data.goals.some((g) => g.status === 'behind');

  const monthlyValue = formatMoney(Math.max(monthly.thisMonthCents, 0));
  const monthlyNote =
    monthly.thisMonthCents <= 0
      ? 'No deposits yet this month'
      : monthly.percentChange !== null
        ? `${monthly.percentChange >= 0 ? '+' : ''}${monthly.percentChange}% vs last month`
        : 'Deposits so far this month';

  return (
    <Screen showGuestBanner>
      <PageHeader
        title="Savings & Goals"
        subtitle="Track your savings, build better habits, and reach your goals."
        backLink={{ label: 'Back to Dashboard', href: '/' }}
        right={
          <Button
            label="+ New Goal"
            size="sm"
            shape="rounded"
            onPress={() => openNewGoal()}
            accessibilityLabel="New savings goal"
          />
        }
      />

      {data.errorMessage ? (
        <Card style={{ gap: Space[2] }}>
          <ThemedText type="smallBold">We couldn&rsquo;t load all of your savings</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data.errorMessage}
          </ThemedText>
          <Button label="Try again" variant="outline" size="sm" onPress={() => void refresh()} />
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[5] }}>
        <TotalSavedCard
          totalCents={summary.totalSavedCents}
          note={
            summary.totalSavedCents === 0
              ? 'Your first deposit will show up here.'
              : anyBehind
                ? 'Every deposit gets you closer.'
                : "You're building momentum. Keep it up."
          }
        />
        <StatCard
          label="Monthly savings"
          value={monthlyValue}
          description={monthlyNote}
          valueColor={monthly.thisMonthCents > 0 ? 'text' : 'disabled'}
        />
        <StatCard
          label="Badges earned"
          value={`${data.badgesEarnedCount} ${data.badgesEarnedCount === 1 ? 'Badge' : 'Badges'}`}
          description={
            data.badgesEarnedCount > 0
              ? 'Great progress — keep going!'
              : 'Keep saving to unlock more.'
          }
        />
      </View>

      <Card style={{ gap: Space[4], borderRadius: Radius.hero }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[3] }}>
          <View
            accessibilityElementsHidden
            style={{
              width: 38,
              height: 38,
              borderRadius: Radius.input,
              backgroundColor: theme.backgroundSelected,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: theme.solidAccent,
              }}
            />
          </View>
          <ThemedText
            accessibilityRole="header"
            style={{ fontFamily: Fonts.heading.semibold, fontSize: 18 }}
          >
            Savings Summary
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] }}>
          <SummaryItem label="Total savings" value={formatMoney(summary.totalSavedCents)} />
          <SummaryItem
            label="52-week total"
            value={formatMoney(summary.challengeSavedCents)}
            color={theme.solidAccent}
          />
          <SummaryItem label="Emergency goals" value={formatMoney(summary.emergencySavedCents)} />
          <SummaryItem label="Active goals" value={String(summary.activeGoalCount)} />
          <SummaryItem
            label="Completed"
            value={String(summary.completedGoalCount)}
            color={theme.success}
          />
          <SummaryItem
            label="Badges"
            value={String(data.badgesEarnedCount)}
            color={theme.primary}
          />
        </View>
      </Card>

      <View style={{ gap: Space[4] }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: Space[3],
          }}
        >
          <ThemedText
            accessibilityRole="header"
            style={{ fontFamily: Fonts.heading.semibold, fontSize: 18 }}
          >
            Active Savings Goals
          </ThemedText>
          {data.challenges.length === 0 && !hasNoGoals ? (
            <Button
              label="Start a 52-week challenge"
              variant="quiet"
              size="sm"
              onPress={() => openNewGoal('challenge')}
            />
          ) : null}
        </View>
        {hasNoGoals && !data.isLoading ? (
          <EmptyState
            title="No savings goals yet"
            message="Set a goal for something you care about, or try the 52-week challenge — small, steady deposits add up."
            action={
              <View style={{ gap: Space[2] }}>
                <Button label="+ New Goal" variant="panel" onPress={() => openNewGoal()} />
                <Button
                  label="Start a 52-week challenge"
                  variant="outline"
                  onPress={() => openNewGoal('challenge')}
                />
              </View>
            }
          />
        ) : goalCards.length > 0 ? (
          <CardGrid>{goalCards}</CardGrid>
        ) : (
          <ThemedText themeColor="textSecondary">Loading your goals…</ThemedText>
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
              onComplete={() => data.markMissionComplete(mission.id)}
            />
          ))}
        </View>
      </SectionCard>
    </Screen>
  );
}

function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** The hero stat: Total Saved on a Panel-to-teal gradient with a $ tile, white text throughout. */
function TotalSavedCard({ totalCents, note }: { totalCents: number; note: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 240, borderRadius: Radius.hero, overflow: 'hidden' }}>
      <LinearGradient
        colors={[Brand.panel, '#00758F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: Space[7], gap: Space[3], minHeight: 168, justifyContent: 'center' }}
      >
        <View
          accessibilityElementsHidden
          style={{
            width: 38,
            height: 38,
            borderRadius: Radius.input,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText style={{ color: '#FFFFFF', fontFamily: Fonts.body.bold, fontSize: 18 }}>
            $
          </ThemedText>
        </View>
        <ThemedText type="eyebrow" style={{ color: '#FFFFFF', fontSize: 12 }}>
          Total saved
        </ThemedText>
        <ThemedText
          style={{
            color: '#FFFFFF',
            fontFamily: Fonts.heading.bold,
            fontSize: 32,
            lineHeight: 40,
            letterSpacing: -0.32,
          }}
        >
          {formatMoney(totalCents)}
        </ThemedText>
        <ThemedText type="small" style={{ color: '#FFFFFF' }}>
          {note}
        </ThemedText>
      </LinearGradient>
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 110, gap: Space[1] }}>
      <ThemedText
        type="eyebrow"
        themeColor="textSecondary"
        style={{ fontSize: 11, letterSpacing: 0.8 }}
      >
        {label}
      </ThemedText>
      <ThemedText
        style={{
          fontFamily: Fonts.heading.semibold,
          fontSize: 24,
          lineHeight: 30,
          ...(color ? { color } : {}),
        }}
      >
        {value}
      </ThemedText>
    </View>
  );
}
