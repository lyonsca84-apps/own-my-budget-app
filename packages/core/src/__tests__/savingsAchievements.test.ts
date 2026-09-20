import {
  buildChallengeBlocks,
  calculateEmergencyFundTarget,
  challengeAmountsFor,
  challengeWeeksCompleted,
  evaluateBadges,
  evaluateMissions,
  getGoalStatus,
  inferGoalCategory,
  longestWeeklyStreak,
  suggestedContributionCents,
  summarizeMonthlySavings,
  summarizeSavingsGoals,
  type AchievementSignals,
} from '../savings';

const emptySignals: AchievementSignals = {
  goals: [],
  challenges: [],
  deposits: [],
  hasBudgetPlan: false,
  billsTotal: 0,
  billsPaid: 0,
  hasPaidOffDebt: false,
  hasAssignedPaycheck: false,
};

describe('inferGoalCategory', () => {
  it('recognises the common goal names', () => {
    expect(inferGoalCategory('Emergency Fund')).toBe('Emergency Fund');
    expect(inferGoalCategory('Family Vacation')).toBe('Vacation');
    expect(inferGoalCategory('New Laptop')).toBe('Major Purchase');
    expect(inferGoalCategory('Christmas gifts')).toBe('Holiday');
    expect(inferGoalCategory('House down payment')).toBe('Home');
    expect(inferGoalCategory('Something else')).toBe('General Savings');
  });
});

describe('calculateEmergencyFundTarget', () => {
  it('multiplies monthly expenses by months and guards bad input', () => {
    expect(calculateEmergencyFundTarget(200_000, 3)).toBe(600_000);
    expect(calculateEmergencyFundTarget(0, 3)).toBe(0);
    expect(calculateEmergencyFundTarget(200_000, 0)).toBe(0);
  });
});

describe('getGoalStatus', () => {
  const today = new Date(2026, 5, 1); // 2026-06-01, halfway through the span below
  const base = { startDate: '2026-01-01', targetDate: '2027-01-01', today };

  it('is completed when the target is met', () => {
    expect(getGoalStatus({ ...base, savedCents: 100, targetCents: 100 })).toBe('completed');
  });
  it('is notStarted with nothing saved', () => {
    expect(getGoalStatus({ ...base, savedCents: 0, targetCents: 100 })).toBe('notStarted');
  });
  it('is onTrack when at or ahead of pace, behind when well under it', () => {
    expect(getGoalStatus({ ...base, savedCents: 50, targetCents: 100 })).toBe('onTrack');
    expect(getGoalStatus({ ...base, savedCents: 10, targetCents: 100 })).toBe('behind');
  });
  it('is inProgress without dates', () => {
    expect(getGoalStatus({ savedCents: 10, targetCents: 100 })).toBe('inProgress');
  });
});

describe('suggestedContributionCents', () => {
  const today = new Date(2026, 0, 1);
  it('spreads the remainder over the periods left', () => {
    // 12 months (~365 days) left → ~12 monthly periods
    expect(suggestedContributionCents(120_000, '2027-01-01', 'monthly', today)).toBe(10_000);
  });
  it('returns null with nothing left or no date', () => {
    expect(suggestedContributionCents(0, '2027-01-01', 'monthly', today)).toBeNull();
    expect(suggestedContributionCents(1000, null, 'weekly', today)).toBeNull();
  });
  it('collapses a past date into one period', () => {
    expect(suggestedContributionCents(5_000, '2025-01-01', 'weekly', today)).toBe(5_000);
  });
});

describe('summarizeSavingsGoals', () => {
  it('totals saved money and splits emergency / challenge / active / completed', () => {
    const summary = summarizeSavingsGoals([
      { label: 'Emergency Fund', savedCents: 3_200, targetCents: 6_000, isChallenge: false },
      { label: '52-week challenge', savedCents: 500, targetCents: 137_800, isChallenge: true },
      { label: 'New Laptop', savedCents: 1_200, targetCents: 1_200, isChallenge: false },
    ]);
    expect(summary).toEqual({
      totalSavedCents: 4_900,
      challengeSavedCents: 500,
      emergencySavedCents: 3_200,
      emergencyGoalCount: 1,
      activeGoalCount: 2,
      completedGoalCount: 1,
    });
  });
});

describe('summarizeMonthlySavings', () => {
  const today = new Date(2026, 8, 20);
  it('nets deposits and withdrawals per month and reports change', () => {
    const result = summarizeMonthlySavings(
      [
        { kind: 'deposit', amountCents: 20_000, occurredOn: '2026-09-02' },
        { kind: 'withdrawal', amountCents: 5_000, occurredOn: '2026-09-10' },
        { kind: 'deposit', amountCents: 10_000, occurredOn: '2026-08-15' },
        { kind: 'deposit', amountCents: 99_900, occurredOn: '2026-06-15' },
      ],
      today
    );
    expect(result).toEqual({
      thisMonthCents: 15_000,
      lastMonthCents: 10_000,
      hasLastMonth: true,
      percentChange: 50,
    });
  });
  it('handles a January → December year boundary and no history', () => {
    const jan = new Date(2027, 0, 5);
    expect(
      summarizeMonthlySavings(
        [{ kind: 'deposit', amountCents: 100, occurredOn: '2026-12-31' }],
        jan
      ).lastMonthCents
    ).toBe(100);
    expect(summarizeMonthlySavings([], today).percentChange).toBeNull();
  });
});

describe('challenge weeks', () => {
  const amounts = challengeAmountsFor('classic_ascending', 52, 137_800);

  it('sums to the target and counts weeks covered by the saved total', () => {
    expect(amounts).toHaveLength(52);
    expect(challengeWeeksCompleted(0, amounts)).toBe(0);
    expect(challengeWeeksCompleted(100 + 200 + 300, amounts)).toBe(3);
    expect(challengeWeeksCompleted(100 + 200 + 299, amounts)).toBe(2);
    expect(challengeWeeksCompleted(137_800, amounts)).toBe(52);
  });

  it('groups weeks into 11 blocks of five (last block has two)', () => {
    const blocks = buildChallengeBlocks(amounts, 100 + 200 + 300 + 400 + 500 + 600);
    expect(blocks).toHaveLength(11);
    expect(blocks[0].allDone).toBe(true);
    expect(blocks[1].doneCount).toBe(1);
    expect(blocks[10].weeks).toHaveLength(2);
  });

  it('treats a custom challenge like the classic pacing', () => {
    expect(challengeAmountsFor('custom', 52, 137_800)).toEqual(amounts);
  });
});

describe('longestWeeklyStreak', () => {
  it('counts consecutive Monday-start weeks', () => {
    // 2026-09-07 is a Monday
    expect(
      longestWeeklyStreak(['2026-09-07', '2026-09-13', '2026-09-14', '2026-09-21', '2026-09-30'])
    ).toBe(4);
  });
  it('breaks on a gap and ignores duplicates', () => {
    expect(longestWeeklyStreak(['2026-09-07', '2026-09-08', '2026-09-28'])).toBe(1);
    expect(longestWeeklyStreak([])).toBe(0);
  });
});

describe('evaluateBadges', () => {
  const byId = (badges: ReturnType<typeof evaluateBadges>) =>
    Object.fromEntries(badges.map((b) => [b.id, b]));

  it('earns nothing for an empty account, with all 12 badges listed', () => {
    const badges = evaluateBadges(emptySignals);
    expect(badges).toHaveLength(12);
    expect(badges.every((b) => !b.earned)).toBe(true);
  });

  it('earns starter, deposit, goal and emergency badges from goals and deposits', () => {
    const badges = byId(
      evaluateBadges({
        ...emptySignals,
        goals: [
          {
            id: 'g1',
            label: 'Emergency Fund',
            savedCents: 100_000,
            targetCents: 100_000,
            isChallenge: false,
            createdAt: '2026-06-01T12:00:00Z',
          },
        ],
        deposits: [
          { goalId: 'g1', amountCents: 60_000, occurredOn: '2026-06-02' },
          { goalId: 'g1', amountCents: 40_000, occurredOn: '2026-07-01' },
        ],
      })
    );
    expect(badges.savingsStarter.earned).toBe(true);
    expect(badges.savingsStarter.earnedOn).toBe('2026-06-01');
    expect(badges.firstDeposit.earnedOn).toBe('2026-06-02');
    expect(badges.goalGetter.earnedOn).toBe('2026-07-01');
    expect(badges.emergencyReady.earned).toBe(true);
    expect(badges.challengeStarter.earned).toBe(false);
  });

  it('tracks challenge progress and quarter completion', () => {
    const target = 137_800;
    const amounts = challengeAmountsFor('classic_ascending', 52, target);
    const thirteen = amounts.slice(0, 13).reduce((a, b) => a + b, 0);
    const badges = byId(
      evaluateBadges({
        ...emptySignals,
        goals: [
          {
            id: 'c1',
            label: '52-week challenge',
            savedCents: thirteen,
            targetCents: target,
            isChallenge: true,
            createdAt: '2026-01-05T00:00:00Z',
          },
        ],
        challenges: [
          {
            goalId: 'c1',
            challengeType: 'classic_ascending',
            totalWeeks: 52,
            createdAt: '2026-01-05T00:00:00Z',
          },
        ],
      })
    );
    expect(badges.challengeStarter.earned).toBe(true);
    expect(badges.quarterComplete.earned).toBe(true);
    expect(badges.challengeMaster.earned).toBe(false);
    expect(badges.challengeMaster.progress).toEqual({ now: 13, of: 52, label: '13 / 52 weeks' });
  });

  it('shows emergency progress and bill progress, and earns streak/budget/debt/paycheck badges', () => {
    const badges = byId(
      evaluateBadges({
        ...emptySignals,
        goals: [
          {
            id: 'g1',
            label: 'Emergency Fund',
            savedCents: 30_000,
            targetCents: 60_000,
            isChallenge: false,
            createdAt: '2026-06-01',
          },
        ],
        deposits: ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((occurredOn) => ({
          goalId: 'g1',
          amountCents: 100,
          occurredOn,
        })),
        hasBudgetPlan: true,
        billsTotal: 4,
        billsPaid: 3,
        hasPaidOffDebt: true,
        hasAssignedPaycheck: true,
      })
    );
    expect(badges.emergencyReady.earned).toBe(false);
    expect(badges.emergencyReady.progress?.label).toBe('$300 of $600');
    expect(badges.streakSaver.earned).toBe(true);
    expect(badges.budgetBuilder.earned).toBe(true);
    expect(badges.billBoss.earned).toBe(false);
    expect(badges.billBoss.progress?.label).toBe('3 / 4 bills paid');
    expect(badges.debtCrusher.earned).toBe(true);
    expect(badges.paycheckPlanner.earned).toBe(true);
  });
});

describe('evaluateMissions', () => {
  it('computes progress from signals and honours manual completion', () => {
    const missions = evaluateMissions({
      trackedDays: 7,
      depositsThisMonth: 2,
      emergencyPercent: 35,
    });
    const byId = Object.fromEntries(missions.map((m) => [m.id, m]));
    expect(byId.trackExpenses).toMatchObject({ progress: 100, done: true });
    expect(byId.monthlyDeposits.progress).toBe(50);
    expect(byId.emergencyCushion.progress).toBe(35);
    expect(byId.reviewSubscriptions).toMatchObject({ progress: 0, done: false });

    const withManual = evaluateMissions(
      { trackedDays: 0, depositsThisMonth: 0, emergencyPercent: null },
      { reviewSubscriptions: true }
    );
    expect(withManual.find((m) => m.id === 'reviewSubscriptions')?.done).toBe(true);
    expect(withManual.find((m) => m.id === 'emergencyCushion')?.progress).toBe(0);
  });
});
