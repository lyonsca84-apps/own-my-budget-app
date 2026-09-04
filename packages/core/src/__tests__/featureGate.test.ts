import { evaluateFeatureGate } from '../featureGate';
import { canScanReceipt } from '../features/receiptScans';
import { canCreateSavingsGoal } from '../features/savingsGoals';
import { canUseBudgetBuddy } from '../features/budgetBuddy';
import { canInviteHouseholdMember } from '../features/householdSharing';

describe('evaluateFeatureGate — count features (lifetime period)', () => {
  it('allows free users under the lifetime limit', () => {
    const result = evaluateFeatureGate('receiptScan', { plan: 'free', currentUsage: 1 });
    expect(result).toMatchObject({ allowed: true, kind: 'count', limit: 2, remaining: 1 });
  });

  it('blocks free users at the lifetime limit with an upgrade reason', () => {
    const result = evaluateFeatureGate('receiptScan', { plan: 'free', currentUsage: 2 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toMatch(/upgrade to guided/i);
  });

  it('treats missing currentUsage as zero', () => {
    const result = evaluateFeatureGate('savingsGoal', { plan: 'free' });
    expect(result).toMatchObject({ allowed: true, remaining: 2 });
  });
});

describe('evaluateFeatureGate — count features (monthly period)', () => {
  it('allows guided users under their monthly limit', () => {
    const result = evaluateFeatureGate('receiptScan', { plan: 'guided', currentUsage: 3 });
    expect(result).toMatchObject({ allowed: true, kind: 'count', limit: 5, remaining: 2 });
  });

  it('blocks guided users at the monthly limit and points to budgetBuddy', () => {
    const result = evaluateFeatureGate('receiptScan', { plan: 'guided', currentUsage: 5 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/this month/i);
    expect(result.reason).toMatch(/upgrade to budget buddy/i);
  });

  it('still meters the top tier — budgetBuddy is never literally unlimited', () => {
    const under = evaluateFeatureGate('receiptScan', { plan: 'budgetBuddy', currentUsage: 29 });
    expect(under.allowed).toBe(true);

    const atLimit = evaluateFeatureGate('receiptScan', { plan: 'budgetBuddy', currentUsage: 30 });
    expect(atLimit.allowed).toBe(false);
    // No tier above budgetBuddy, so the message should not offer an upgrade.
    expect(atLimit.reason).not.toMatch(/upgrade/i);
    expect(atLimit.reason).toMatch(/resets next month/i);
  });
});

describe('evaluateFeatureGate — count features with no period (resource ceilings)', () => {
  it('never blocks guided or budgetBuddy users on savings goals', () => {
    expect(evaluateFeatureGate('savingsGoal', { plan: 'guided', currentUsage: 500 })).toEqual({
      allowed: true,
      kind: 'unlimited',
    });
    expect(evaluateFeatureGate('savingsGoal', { plan: 'budgetBuddy', currentUsage: 500 })).toEqual({
      allowed: true,
      kind: 'unlimited',
    });
  });
});

describe('evaluateFeatureGate — flag features', () => {
  it('blocks free and guided users from advanced debt scenarios', () => {
    expect(evaluateFeatureGate('advancedDebtScenarios', { plan: 'free' }).allowed).toBe(false);
    expect(evaluateFeatureGate('advancedDebtScenarios', { plan: 'guided' }).allowed).toBe(false);
  });

  it('allows budgetBuddy users advanced debt scenarios', () => {
    expect(evaluateFeatureGate('advancedDebtScenarios', { plan: 'budgetBuddy' }).allowed).toBe(
      true
    );
  });

  it('household sharing is disabled for every tier — deferred out of v1', () => {
    expect(evaluateFeatureGate('householdSharing', { plan: 'free' }).allowed).toBe(false);
    expect(evaluateFeatureGate('householdSharing', { plan: 'guided' }).allowed).toBe(false);
    expect(evaluateFeatureGate('householdSharing', { plan: 'budgetBuddy' }).allowed).toBe(false);
  });
});

describe('evaluateFeatureGate — unknown feature', () => {
  it('throws so a typo cannot silently bypass a gate', () => {
    // @ts-expect-error deliberately invalid key
    expect(() => evaluateFeatureGate('notARealFeature', { plan: 'free' })).toThrow(
      /unknown feature/i
    );
  });
});

describe('feature wrappers delegate to the registry', () => {
  it('canScanReceipt matches evaluateFeatureGate("receiptScan")', () => {
    expect(canScanReceipt({ plan: 'free', scansUsed: 2 }).allowed).toBe(false);
  });

  it('canCreateSavingsGoal matches evaluateFeatureGate("savingsGoal")', () => {
    expect(canCreateSavingsGoal({ plan: 'free', activeGoalCount: 1 }).allowed).toBe(true);
  });

  it('canUseBudgetBuddy meters Free to a small one-time taste', () => {
    expect(canUseBudgetBuddy({ plan: 'free', actionsUsed: 2 }).allowed).toBe(true);
    expect(canUseBudgetBuddy({ plan: 'free', actionsUsed: 3 }).allowed).toBe(false);
  });

  it('canUseBudgetBuddy gives Guided a monthly allowance well below budgetBuddy', () => {
    const result = canUseBudgetBuddy({ plan: 'guided', actionsUsed: 0 });
    expect(result).toMatchObject({ allowed: true, limit: 20 });
  });

  it('canInviteHouseholdMember is disabled on every tier', () => {
    expect(canInviteHouseholdMember({ plan: 'free' }).allowed).toBe(false);
    expect(canInviteHouseholdMember({ plan: 'budgetBuddy' }).allowed).toBe(false);
  });
});
