import { emptyClient } from '../guest/test-utils';
import type { GuestClient } from '../guest';

let client: GuestClient;
let userId: string;

beforeEach(async () => {
  client = await emptyClient();
  userId = client.guest.userId;
});

async function makeDebt(balance: number) {
  const { data } = await client
    .from('debts')
    .insert({ user_id: userId, label: 'Card', balance_cents: balance })
    .select()
    .single();
  return data!;
}

async function makeGoal(saved: number) {
  const { data } = await client
    .from('savings_goals')
    .insert({ user_id: userId, label: 'Goal', target_cents: 100000, saved_cents: saved })
    .select()
    .single();
  return data!;
}

describe('record_debt_payment', () => {
  it('inserts the payment and lowers the balance', async () => {
    const debt = await makeDebt(50000);
    const res = await client.rpc('record_debt_payment', {
      p_debt_id: debt.id,
      p_amount_cents: 12000,
      p_paid_on: '2026-09-20',
    });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({
      user_id: userId,
      debt_id: debt.id,
      amount_cents: 12000,
      paid_on: '2026-09-20',
    });
    const after = await client.from('debts').select('balance_cents').eq('id', debt.id).single();
    expect(after.data).toEqual({ balance_cents: 38000 });
    expect((await client.from('debt_payments').select('id')).data).toHaveLength(1);
  });

  it('never takes the balance below zero', async () => {
    const debt = await makeDebt(1000);
    await client.rpc('record_debt_payment', {
      p_debt_id: debt.id,
      p_amount_cents: 5000,
      p_paid_on: '2026-09-20',
    });
    expect((await client.from('debts').select('balance_cents').single()).data).toEqual({
      balance_cents: 0,
    });
  });

  it('is atomic: an unknown debt fails with an FK error and writes nothing', async () => {
    const res = await client.rpc('record_debt_payment', {
      p_debt_id: '11111111-1111-4111-8111-111111111111',
      p_amount_cents: 100,
      p_paid_on: '2026-09-20',
    });
    expect(res.error?.code).toBe('23503');
    expect((await client.from('debt_payments').select('id')).data).toEqual([]);
  });

  it('rejects fractional cents like Postgres does', async () => {
    const debt = await makeDebt(1000);
    const res = await client.rpc('record_debt_payment', {
      p_debt_id: debt.id,
      p_amount_cents: 10.5,
      p_paid_on: '2026-09-20',
    });
    expect(res.error?.code).toBe('22P02');
  });

  it('checks the argument names like PostgREST (PGRST202)', async () => {
    const res = await client.rpc('record_debt_payment', { debt_id: 'x' } as never);
    expect(res.error?.code).toBe('PGRST202');
    expect((await client.rpc('does_not_exist' as never)).error?.code).toBe('PGRST202');
  });
});

describe('record_goal_activity', () => {
  it('deposit adds to saved_cents; withdrawal subtracts (floored at 0)', async () => {
    const goal = await makeGoal(1000);
    const args = { p_goal_id: goal.id, p_note: 'x', p_occurred_on: '2026-09-20' };
    const dep = await client.rpc('record_goal_activity', {
      ...args,
      p_amount_cents: 500,
      p_kind: 'deposit',
    });
    expect(dep.data).toMatchObject({ kind: 'deposit', amount_cents: 500, note: 'x' });
    expect((await client.from('savings_goals').select('saved_cents').single()).data).toEqual({
      saved_cents: 1500,
    });
    await client.rpc('record_goal_activity', {
      ...args,
      p_amount_cents: 9999,
      p_kind: 'withdrawal',
    });
    expect((await client.from('savings_goals').select('saved_cents').single()).data).toEqual({
      saved_cents: 0,
    });
  });

  it("rejects any other kind with the function's own exception", async () => {
    const goal = await makeGoal(0);
    const res = await client.rpc('record_goal_activity', {
      p_goal_id: goal.id,
      p_amount_cents: 1,
      p_kind: 'transfer',
      p_note: '',
      p_occurred_on: '2026-09-20',
    });
    expect(res.error?.code).toBe('P0001');
    expect(res.error?.message).toContain('kind must be deposit or withdrawal');
    expect((await client.from('goal_activity').select('id')).data).toEqual([]);
  });

  it('defaults occurred_on to today when null', async () => {
    const goal = await makeGoal(0);
    const res = await client.rpc('record_goal_activity', {
      p_goal_id: goal.id,
      p_amount_cents: 1,
      p_kind: 'deposit',
      p_note: '',
      p_occurred_on: null as never,
    });
    expect(res.data).toMatchObject({ occurred_on: '2026-09-20' });
  });
});

async function deposit(goalId: string, amount: number, kind = 'deposit') {
  const res = await client.rpc('record_goal_activity', {
    p_goal_id: goalId,
    p_amount_cents: amount,
    p_kind: kind,
    p_note: 'orig',
    p_occurred_on: '2026-09-01',
  });
  return res.data!;
}

const savedOf = async (goalId: string) =>
  (await client.from('savings_goals').select('saved_cents').eq('id', goalId).single()).data!
    .saved_cents;

describe('update_goal_activity', () => {
  it('changes the row and moves the goal by the difference (deposit)', async () => {
    const goal = await makeGoal(0);
    const row = await deposit(goal.id, 2000);
    const res = await client.rpc('update_goal_activity', {
      p_activity_id: row.id,
      p_amount_cents: 3500,
      p_occurred_on: '2026-09-10',
      p_note: 'edited',
    });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({
      amount_cents: 3500,
      occurred_on: '2026-09-10',
      note: 'edited',
    });
    expect(await savedOf(goal.id)).toBe(3500);
    const lowered = await client.rpc('update_goal_activity', {
      p_activity_id: row.id,
      p_amount_cents: 500,
      p_occurred_on: '2026-09-10',
      p_note: 'edited',
    });
    expect(lowered.error).toBeNull();
    expect(await savedOf(goal.id)).toBe(500);
  });

  it('reverses direction for a withdrawal', async () => {
    const goal = await makeGoal(10000);
    const row = await deposit(goal.id, 1000, 'withdrawal');
    expect(await savedOf(goal.id)).toBe(9000);
    await client.rpc('update_goal_activity', {
      p_activity_id: row.id,
      p_amount_cents: 4000,
      p_occurred_on: '2026-09-01',
      p_note: '',
    });
    expect(await savedOf(goal.id)).toBe(6000);
  });

  it('rejects a missing activity and a non-positive amount, changing nothing', async () => {
    const goal = await makeGoal(0);
    const row = await deposit(goal.id, 1000);
    const missing = await client.rpc('update_goal_activity', {
      p_activity_id: '5eed0000-0000-4000-8000-00000000ffff',
      p_amount_cents: 100,
      p_occurred_on: '2026-09-01',
      p_note: '',
    });
    expect(missing.error?.message).toContain('not found');
    const zero = await client.rpc('update_goal_activity', {
      p_activity_id: row.id,
      p_amount_cents: 0,
      p_occurred_on: '2026-09-01',
      p_note: '',
    });
    expect(zero.error?.message).toContain('greater than zero');
    expect(await savedOf(goal.id)).toBe(1000);
  });
});

describe('delete_goal_activity', () => {
  it('removes the row and reverses a deposit', async () => {
    const goal = await makeGoal(0);
    const first = await deposit(goal.id, 2000);
    await deposit(goal.id, 500);
    const res = await client.rpc('delete_goal_activity', { p_activity_id: first.id });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ id: first.id, amount_cents: 2000 });
    expect(await savedOf(goal.id)).toBe(500);
    expect((await client.from('goal_activity').select('id')).data).toHaveLength(1);
  });

  it('adds a withdrawal back, and never goes below zero', async () => {
    const goal = await makeGoal(1000);
    const out = await deposit(goal.id, 400, 'withdrawal');
    await client.rpc('delete_goal_activity', { p_activity_id: out.id });
    expect(await savedOf(goal.id)).toBe(1000);
    const big = await deposit(goal.id, 800);
    // Something else already spent the money: the goal only has 300 left.
    await client.from('savings_goals').update({ saved_cents: 300 }).eq('id', goal.id);
    await client.rpc('delete_goal_activity', { p_activity_id: big.id });
    expect(await savedOf(goal.id)).toBe(0);
  });

  it('errors for an unknown activity', async () => {
    const res = await client.rpc('delete_goal_activity', {
      p_activity_id: '5eed0000-0000-4000-8000-00000000ffff',
    });
    expect(res.error?.message).toContain('not found');
  });
});

describe('record_challenge_week', () => {
  const call = (goalId: string, week: number, amount = 300) =>
    client.rpc('record_challenge_week', {
      p_goal_id: goalId,
      p_week: week,
      p_amount_cents: amount,
      p_occurred_on: '2026-09-20',
    });

  it('inserts a tagged deposit and raises the total', async () => {
    const goal = await makeGoal(0);
    const res = await call(goal.id, 3);
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({
      kind: 'deposit',
      challenge_week: 3,
      note: 'Week 3',
      amount_cents: 300,
      occurred_on: '2026-09-20',
    });
    expect(await savedOf(goal.id)).toBe(300);
  });

  it('refuses to record the same week twice (and leaves the total alone)', async () => {
    const goal = await makeGoal(0);
    await call(goal.id, 3);
    const again = await call(goal.id, 3);
    expect(again.error?.message).toContain('already recorded');
    expect(await savedOf(goal.id)).toBe(300);
    expect((await call(goal.id, 4)).error).toBeNull();
    expect(await savedOf(goal.id)).toBe(600);
  });

  it('validates week and amount', async () => {
    const goal = await makeGoal(0);
    expect((await call(goal.id, 0)).error?.message).toContain('week must be positive');
    expect((await call(goal.id, 1, 0)).error?.message).toContain('greater than zero');
  });
});

describe('increment_feature_usage', () => {
  const args = { p_user_id: '', p_feature_key: 'receiptScan', p_period_start: '2026-09-01' };

  it('is not callable by the client role (EXECUTE is revoked)', async () => {
    const res = await client.rpc('increment_feature_usage', { ...args, p_user_id: userId });
    expect(res.error?.code).toBe('42501');
  });

  it('upserts then increments, for the service role', async () => {
    const service = client.guest.service;
    const first = await service.rpc('increment_feature_usage', { ...args, p_user_id: userId });
    expect(first.data).toMatchObject({ used_count: 1, feature_key: 'receiptScan' });
    const second = await service.rpc('increment_feature_usage', { ...args, p_user_id: userId });
    expect(second.data).toMatchObject({ used_count: 2, id: first.data!.id });
    // and the client can read it back the way getFeatureUsageCount does
    const read = await client
      .from('feature_usage')
      .select('used_count')
      .eq('feature_key', 'receiptScan')
      .maybeSingle();
    expect(read.data).toEqual({ used_count: 2 });
  });
});
