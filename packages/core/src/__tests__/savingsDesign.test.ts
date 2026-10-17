import {
  CHALLENGE_MULTIPLIERS,
  buildChallengeBlocksFromRecords,
  buildSavingsActivity,
  challengeAmountsFor,
  challengeEndDate,
  challengeTargetCents,
  evaluateBadges,
  filterSavingsActivity,
  getGoalStatus,
  resolveGoalCategory,
  resolveGoalFrequency,
  suggestedContributionCents,
  weeklyStreakReachedOn,
  type AchievementSignals,
} from '../savings';

describe('challengeTargetCents', () => {
  it('is 1+2+...+N dollars times the multiplier', () => {
    expect(challengeTargetCents(52, 1)).toBe(137_800);
    expect(challengeTargetCents(52, 5)).toBe(689_000);
    expect(challengeTargetCents(26, 1)).toBe(35_100);
  });
  it('guards bad input', () => {
    expect(challengeTargetCents(0, 1)).toBe(0);
    expect(challengeTargetCents(52, 0)).toBe(0);
  });
  it('matches the weekly amounts derived from the target for every multiplier', () => {
    for (const m of CHALLENGE_MULTIPLIERS) {
      const target = challengeTargetCents(52, m);
      const amounts = challengeAmountsFor('classic_ascending', 52, target);
      expect(amounts[0]).toBe(100 * m);
      expect(amounts[51]).toBe(5200 * m);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(target);
    }
  });
});

describe('challengeEndDate', () => {
  it('is the start date plus 52 weeks (design: Jan 5 -> Jan 4, 2027)', () => {
    expect(challengeEndDate('2026-01-05', 52, 'weekly')).toBe('2027-01-04');
  });
  it('doubles the period for a biweekly challenge', () => {
    expect(challengeEndDate('2026-01-05', 26, 'biweekly')).toBe('2027-01-04');
    expect(challengeEndDate('2026-01-05', 26, 'weekly')).toBe('2026-07-06');
  });
});

describe('buildChallengeBlocksFromRecords', () => {
  const targets = challengeAmountsFor('classic_ascending', 52, challengeTargetCents(52, 1));

  it('groups 52 weeks into 11 blocks, the last one holding weeks 51-52', () => {
    const blocks = buildChallengeBlocksFromRecords(targets, {});
    expect(blocks).toHaveLength(11);
    expect(blocks[0].label).toBe('Weeks 1-5');
    expect(blocks[10].label).toBe('Weeks 51-52');
    expect(blocks[10].weeks.map((w) => w.week)).toEqual([51, 52]);
  });

  it('reports block targets and the design numbers ($15/$15 done, $0/$40 not started)', () => {
    const recorded = { 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 };
    const blocks = buildChallengeBlocksFromRecords(targets, recorded);
    expect(blocks[0]).toMatchObject({
      savedCents: 1500,
      targetCents: 1500,
      status: 'completed',
      allDone: true,
      doneCount: 5,
    });
    expect(blocks[1]).toMatchObject({
      savedCents: 0,
      targetCents: 4000,
      status: 'notStarted',
      doneCount: 0,
    });
  });

  it('allows weeks to be completed out of order and reports partial blocks as in progress', () => {
    const blocks = buildChallengeBlocksFromRecords(targets, { 8: 800, 40: 4000 });
    expect(blocks[1]).toMatchObject({ status: 'inProgress', doneCount: 1, savedCents: 800 });
    expect(blocks[7].weeks.find((w) => w.week === 40)?.done).toBe(true);
    expect(blocks[0].status).toBe('notStarted');
  });

  it('keeps the recorded amount even when the multiplier later changes the target', () => {
    const doubled = challengeAmountsFor('classic_ascending', 52, challengeTargetCents(52, 2));
    const blocks = buildChallengeBlocksFromRecords(doubled, { 1: 100 });
    expect(blocks[0].weeks[0]).toMatchObject({ savedCents: 100, targetCents: 200, done: true });
  });
});

describe('getGoalStatus with paused', () => {
  it('reports paused for an unfinished paused goal, but completed wins', () => {
    const today = new Date(2026, 5, 1);
    const base = { startDate: '2026-01-01', targetDate: '2027-01-01', today };
    expect(getGoalStatus({ ...base, savedCents: 100, targetCents: 1000, paused: true })).toBe(
      'paused'
    );
    expect(getGoalStatus({ ...base, savedCents: 1000, targetCents: 1000, paused: true })).toBe(
      'completed'
    );
  });
});

describe('suggestedContributionCents biweekly', () => {
  it('spreads the remainder over 14-day periods', () => {
    const today = new Date(2026, 0, 1);
    // 56 days -> 4 biweekly periods
    expect(suggestedContributionCents(40_000, '2026-02-26', 'biweekly', today)).toBe(10_000);
  });
});

describe('resolveGoalCategory / resolveGoalFrequency', () => {
  it('prefers a stored category, falling back to the label', () => {
    expect(resolveGoalCategory('Vacation', 'Whatever')).toBe('Vacation');
    expect(resolveGoalCategory(null, 'Emergency Fund')).toBe('Emergency Fund');
    expect(resolveGoalCategory('Not a category', 'Family Vacation')).toBe('Vacation');
  });
  it('defaults an unknown frequency to monthly', () => {
    expect(resolveGoalFrequency('weekly')).toBe('weekly');
    expect(resolveGoalFrequency(undefined)).toBe('monthly');
    expect(resolveGoalFrequency('yearly')).toBe('monthly');
  });
});

describe('weeklyStreakReachedOn', () => {
  it("returns the first deposit date of the run's last week", () => {
    // Mondays: Jun 1, 8, 15, 22 2026 are four consecutive weeks.
    expect(
      weeklyStreakReachedOn(
        ['2026-06-02', '2026-06-09', '2026-06-16', '2026-06-24', '2026-06-22'],
        4
      )
    ).toBe('2026-06-22');
  });
  it('is null when no long enough run exists', () => {
    expect(weeklyStreakReachedOn(['2026-06-02', '2026-06-09', '2026-06-30'], 4)).toBeNull();
    expect(weeklyStreakReachedOn([], 4)).toBeNull();
  });
});

describe('evaluateBadges design fields', () => {
  const signals: AchievementSignals = {
    goals: [
      {
        id: 'c',
        label: '52-Week Money Challenge',
        savedCents: 1500,
        targetCents: 137_800,
        isChallenge: true,
        createdAt: '2026-07-01',
      },
    ],
    challenges: [
      { goalId: 'c', challengeType: 'classic_ascending', totalWeeks: 52, createdAt: '2026-07-01' },
    ],
    deposits: [],
    hasBudgetPlan: true,
    billsTotal: 0,
    billsPaid: 0,
    hasPaidOffDebt: false,
    hasAssignedPaycheck: true,
    budgetPlanSince: '2026-08-14',
    paycheckAssignedSince: '2026-08-14',
  };

  it('dates the budget and paycheck badges from the signals', () => {
    const badges = evaluateBadges(signals);
    expect(badges.find((b) => b.id === 'budgetBuilder')).toMatchObject({
      earned: true,
      earnedOn: '2026-08-14',
    });
    expect(badges.find((b) => b.id === 'paycheckPlanner')?.earnedOn).toBe('2026-08-14');
  });

  it('uses logged challenge weeks instead of guessing from the saved total', () => {
    // $15 saved would cover 5 classic weeks, but only 2 were actually logged.
    const badges = evaluateBadges({
      ...signals,
      challenges: [{ ...signals.challenges[0], completedWeeks: 2 }],
    });
    expect(badges.find((b) => b.id === 'challengeMaster')?.progress?.label).toBe('2 / 52 weeks');
    expect(badges.find((b) => b.id === 'quarterComplete')?.progress?.now).toBe(2);
  });
});

describe('buildSavingsActivity / filterSavingsActivity', () => {
  const feed = buildSavingsActivity({
    goals: [
      {
        id: 'e',
        label: 'Emergency Fund',
        isChallenge: false,
        savedCents: 500,
        targetCents: 1000,
        createdOn: '2026-06-01',
      },
      {
        id: 'l',
        label: 'New Laptop',
        isChallenge: false,
        savedCents: 1200,
        targetCents: 1200,
        createdOn: '2026-06-05',
      },
      {
        id: 'c',
        label: '52-Week Money Challenge',
        isChallenge: true,
        savedCents: 100,
        targetCents: 137_800,
        createdOn: '2026-07-01',
      },
    ],
    activity: [
      {
        id: 'a1',
        goalId: 'e',
        kind: 'deposit',
        amountCents: 500,
        occurredOn: '2026-06-10',
        note: null,
      },
      {
        id: 'a2',
        goalId: 'e',
        kind: 'withdrawal',
        amountCents: 50,
        occurredOn: '2026-06-20',
        note: null,
      },
      {
        id: 'a3',
        goalId: 'l',
        kind: 'deposit',
        amountCents: 1200,
        occurredOn: '2026-06-15',
        note: 'Bonus',
      },
      {
        id: 'a4',
        goalId: 'c',
        kind: 'deposit',
        amountCents: 100,
        occurredOn: '2026-07-08',
        note: 'Week 1',
      },
      {
        id: 'orphan',
        goalId: 'gone',
        kind: 'deposit',
        amountCents: 9,
        occurredOn: '2026-07-09',
        note: null,
      },
    ],
    badges: [
      { id: 'firstDeposit', name: 'First Deposit', earned: true, earnedOn: '2026-06-10' },
      { id: 'billBoss', name: 'Bill Boss', earned: false, earnedOn: null },
      { id: 'noDate', name: 'No Date', earned: true, earnedOn: null },
    ],
  });

  it('is newest first and skips unearned/undated badges and orphaned activity', () => {
    const dates = feed.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(feed.find((e) => e.id === 'orphan')).toBeUndefined();
    expect(feed.filter((e) => e.kind === 'badgeEarned')).toHaveLength(1);
  });

  it('classifies rows and derives goal created/completed events', () => {
    expect(feed.find((e) => e.id === 'a4')?.kind).toBe('challengeDeposit');
    expect(feed.find((e) => e.id === 'a2')?.kind).toBe('withdrawal');
    expect(feed.find((e) => e.id === 'a3')?.kind).toBe('deposit');
    expect(feed.find((e) => e.id === 'completed-l')).toMatchObject({
      kind: 'goalCompleted',
      date: '2026-06-15',
    });
    expect(feed.find((e) => e.id === 'completed-e')).toBeUndefined();
    expect(feed.find((e) => e.id === 'created-e')?.kind).toBe('goalCreated');
    // The challenge is not announced as a "goal created" row.
    expect(feed.find((e) => e.id === 'created-c')).toBeUndefined();
  });

  it('filters like the design chips', () => {
    expect(filterSavingsActivity(feed, 'all')).toHaveLength(feed.length);
    expect(
      filterSavingsActivity(feed, 'deposits')
        .map((e) => e.id)
        .sort()
    ).toEqual(['a1', 'a2', 'a3']);
    expect(filterSavingsActivity(feed, 'challenges').map((e) => e.id)).toEqual(['a4']);
    expect(
      filterSavingsActivity(feed, 'goals')
        .map((e) => e.kind)
        .sort()
    ).toEqual(['goalCompleted', 'goalCreated', 'goalCreated']);
  });
});
