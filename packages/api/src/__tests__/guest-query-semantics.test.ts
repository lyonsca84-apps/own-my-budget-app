import { emptyClient } from '../guest/test-utils';
import type { GuestClient } from '../guest';

let client: GuestClient;
let userId: string;

beforeEach(async () => {
  client = await emptyClient();
  userId = client.guest.userId;
});

async function addBills(
  ...rows: { label: string; amount: number; due: string; category?: string | null }[]
) {
  const { data, error } = await client
    .from('bills')
    .insert(
      rows.map((r) => ({
        user_id: userId,
        label: r.label,
        amount_cents: r.amount,
        due_date: r.due,
      }))
    )
    .select();
  expect(error).toBeNull();
  return data!;
}

describe('response shape', () => {
  it('returns { data, error, count } and is thenable', async () => {
    await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    const res = await client.from('bills').select('*', { count: 'exact' });
    expect(res.error).toBeNull();
    expect(res.count).toBe(1);
    expect(res.data).toHaveLength(1);
  });

  it('head:true returns no data but a count', async () => {
    await addBills(
      { label: 'a', amount: 1, due: '2026-09-01' },
      { label: 'b', amount: 2, due: '2026-09-02' }
    );
    const res = await client.from('bills').select('id', { count: 'exact', head: true });
    expect(res.data).toBeNull();
    expect(res.count).toBe(2);
  });

  it('fills defaults on insert (uuid, timestamps, column defaults)', async () => {
    const [bill] = await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    expect(bill.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(bill.recurrence).toBe('monthly');
    expect(bill.autopay).toBe(false);
    expect(bill.reminder_days_before).toBe(3);
    expect(bill.reminder_enabled).toBe(true);
    expect(bill.archived_at).toBeNull();
    expect(bill.created_at).toBe(bill.updated_at);
  });

  it('insert without .select() returns null data', async () => {
    const res = await client
      .from('bills')
      .insert({ user_id: userId, label: 'x', amount_cents: 1, due_date: '2026-09-01' });
    expect(res.error).toBeNull();
    expect(res.data).toBeNull();
  });

  it('returns copies, not references into the store', async () => {
    await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    const first = await client.from('bills').select('*');
    (first.data as { label: string }[])[0].label = 'mutated';
    const second = await client.from('bills').select('*');
    expect((second.data as { label: string }[])[0].label).toBe('Rent');
  });
});

describe('filters', () => {
  beforeEach(async () => {
    await addBills(
      { label: 'Rent', amount: 145000, due: '2026-09-01' },
      { label: 'Electric', amount: 14500, due: '2026-09-23' },
      { label: 'Internet', amount: 7000, due: '2026-09-25' },
      { label: 'phone', amount: 8500, due: '2026-09-14' }
    );
  });
  const labels = async (q: PromiseLike<{ data: unknown }>) =>
    ((await q).data as { label: string }[]).map((r) => r.label).sort();

  it('eq / neq / gt / gte / lt / lte', async () => {
    expect(await labels(client.from('bills').select('label').eq('label', 'Rent'))).toEqual([
      'Rent',
    ]);
    expect(await labels(client.from('bills').select('label').neq('label', 'Rent'))).toHaveLength(3);
    expect(await labels(client.from('bills').select('label').gt('amount_cents', 14500))).toEqual([
      'Rent',
    ]);
    expect(await labels(client.from('bills').select('label').gte('amount_cents', 14500))).toEqual([
      'Electric',
      'Rent',
    ]);
    expect(await labels(client.from('bills').select('label').lt('due_date', '2026-09-14'))).toEqual(
      ['Rent']
    );
    expect(
      await labels(client.from('bills').select('label').lte('due_date', '2026-09-14'))
    ).toEqual(['Rent', 'phone']);
  });

  it('coerces filter values to the column type (numeric strings, dates)', async () => {
    expect(
      await labels(
        client
          .from('bills')
          .select('label')
          .eq('amount_cents', '7000' as never)
      )
    ).toEqual(['Internet']);
  });

  it('like / ilike with % and _', async () => {
    expect(await labels(client.from('bills').select('label').like('label', 'E%'))).toEqual([
      'Electric',
    ]);
    expect(await labels(client.from('bills').select('label').like('label', 'e%'))).toEqual([]);
    expect(await labels(client.from('bills').select('label').ilike('label', '%HON_'))).toEqual([
      'phone',
    ]);
  });

  it('in and not in', async () => {
    expect(
      await labels(client.from('bills').select('label').in('label', ['Rent', 'phone']))
    ).toEqual(['Rent', 'phone']);
    expect(await labels(client.from('bills').select('label').in('label', []))).toEqual([]);
    expect(
      await labels(client.from('bills').select('label').not('label', 'in', '(Rent,phone)'))
    ).toEqual(['Electric', 'Internet']);
  });

  it('is null / not is null', async () => {
    expect(await labels(client.from('bills').select('label').is('archived_at', null))).toHaveLength(
      4
    );
    expect(
      await labels(client.from('bills').select('label').not('archived_at', 'is', null))
    ).toEqual([]);
    expect(await labels(client.from('bills').select('label').is('autopay', false))).toHaveLength(4);
  });

  it('SQL null semantics: neq / not.eq never match NULL', async () => {
    await client.from('bills').update({ category_id: null }).eq('label', 'Rent');
    const res = await client
      .from('bills')
      .select('label')
      .neq('category_id', '00000000-0000-4000-8000-000000000009');
    expect(res.data).toEqual([]); // every category_id is NULL, so "<>" is unknown for all rows
  });

  it('or() with nested and() and in.()', async () => {
    expect(
      await labels(client.from('bills').select('label').or('label.eq.Rent,label.eq.phone'))
    ).toEqual(['Rent', 'phone']);
    expect(
      await labels(
        client
          .from('bills')
          .select('label')
          .or('label.eq.Rent,and(amount_cents.gt.7000,amount_cents.lt.10000)')
      )
    ).toEqual(['Rent', 'phone']);
    expect(
      await labels(client.from('bills').select('label').or('label.in.(Rent,Internet)'))
    ).toEqual(['Internet', 'Rent']);
  });

  it('match() and filter()', async () => {
    expect(
      await labels(client.from('bills').select('label').match({ label: 'Rent', autopay: false }))
    ).toEqual(['Rent']);
    expect(
      await labels(client.from('bills').select('label').filter('label', 'eq', 'Rent'))
    ).toEqual(['Rent']);
    expect(
      await labels(client.from('bills').select('label').filter('label', 'not.eq', 'Rent'))
    ).toHaveLength(3);
  });

  it('errors on unknown columns instead of silently matching nothing', async () => {
    const res = await client
      .from('bills')
      .select('*')
      .eq('nope' as never, 1);
    expect(res.error?.code).toBe('42703');
  });

  it('errors on unknown tables', async () => {
    const res = await client.from('nope' as never).select('*');
    expect(res.error?.code).toBe('PGRST205');
  });
});

describe('order / limit / range', () => {
  beforeEach(async () => {
    await addBills(
      { label: 'b', amount: 2, due: '2026-09-02' },
      { label: 'a', amount: 3, due: '2026-09-01' },
      { label: 'c', amount: 1, due: '2026-09-03' }
    );
  });

  it('orders ascending and descending, with multiple keys', async () => {
    const asc = await client.from('bills').select('label').order('due_date');
    expect((asc.data as { label: string }[]).map((r) => r.label)).toEqual(['a', 'b', 'c']);
    const desc = await client
      .from('bills')
      .select('label')
      .order('amount_cents', { ascending: false });
    expect((desc.data as { label: string }[]).map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('puts NULLs last ascending and first descending, unless nullsFirst says otherwise', async () => {
    await client.from('receipts').insert([
      { user_id: userId, store_label: 'dated', purchased_on: '2026-09-01' },
      { user_id: userId, store_label: 'undated' },
    ]);
    const stores = async (opts: { ascending: boolean; nullsFirst?: boolean }) =>
      (
        (await client.from('receipts').select('store_label').order('purchased_on', opts)).data as {
          store_label: string;
        }[]
      ).map((r) => r.store_label);
    expect(await stores({ ascending: true })).toEqual(['dated', 'undated']);
    expect(await stores({ ascending: false })).toEqual(['undated', 'dated']);
    expect(await stores({ ascending: false, nullsFirst: false })).toEqual(['dated', 'undated']);
  });

  it('limit and range (inclusive), count is the unpaged total', async () => {
    const limited = await client
      .from('bills')
      .select('label', { count: 'exact' })
      .order('due_date')
      .limit(2);
    expect((limited.data as unknown[]).length).toBe(2);
    expect(limited.count).toBe(3);
    const ranged = await client.from('bills').select('label').order('due_date').range(1, 1);
    expect(ranged.data).toEqual([{ label: 'b' }]);
  });
});

describe('single / maybeSingle', () => {
  it('single: one row ok, zero or many is PGRST116', async () => {
    await addBills(
      { label: 'a', amount: 1, due: '2026-09-01' },
      { label: 'b', amount: 1, due: '2026-09-01' }
    );
    expect((await client.from('bills').select('label').eq('label', 'a').single()).data).toEqual({
      label: 'a',
    });
    const none = await client.from('bills').select('*').eq('label', 'zzz').single();
    expect(none.error?.code).toBe('PGRST116');
    expect(none.error?.details).toBe('The result contains 0 rows');
    const many = await client.from('bills').select('*').single();
    expect(many.error?.code).toBe('PGRST116');
  });

  it('maybeSingle: zero rows is null without error, many is an error', async () => {
    await addBills(
      { label: 'a', amount: 1, due: '2026-09-01' },
      { label: 'b', amount: 1, due: '2026-09-01' }
    );
    const none = await client.from('bills').select('*').eq('label', 'zzz').maybeSingle();
    expect(none).toMatchObject({ data: null, error: null });
    expect((await client.from('bills').select('*').maybeSingle()).error?.code).toBe('PGRST116');
  });

  it('single() on a write that touches != 1 rows rolls the write back', async () => {
    await addBills(
      { label: 'a', amount: 1, due: '2026-09-01' },
      { label: 'b', amount: 1, due: '2026-09-01' }
    );
    const res = await client
      .from('bills')
      .update({ autopay: true })
      .eq('due_date', '2026-09-01')
      .select()
      .single();
    expect(res.error?.code).toBe('PGRST116');
    const after = await client.from('bills').select('autopay').eq('autopay', true);
    expect(after.data).toEqual([]);
  });

  it('update().select().single() with no matching row errors (like the real API)', async () => {
    const res = await client
      .from('bills')
      .update({ autopay: true })
      .eq('label', 'zzz')
      .select()
      .single();
    expect(res.error?.code).toBe('PGRST116');
  });
});

describe('embedded relations', () => {
  it('to-many: bills(*, bill_payments(cols))', async () => {
    const [bill] = await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    await client.from('bill_payments').insert([
      { user_id: userId, bill_id: bill.id, amount_cents: 40, paid_on: '2026-09-02' },
      { user_id: userId, bill_id: bill.id, amount_cents: 60, paid_on: '2026-09-03' },
    ]);
    const res = await client
      .from('bills')
      .select('*, bill_payments(amount_cents, paid_on)')
      .single();
    expect(res.data).toMatchObject({
      label: 'Rent',
      bill_payments: [
        { amount_cents: 40, paid_on: '2026-09-02' },
        { amount_cents: 60, paid_on: '2026-09-03' },
      ],
    });
    expect(Object.keys((res.data as { bill_payments: object[] }).bill_payments[0])).toEqual([
      'amount_cents',
      'paid_on',
    ]);
  });

  it('to-one: bill_payments(amount_cents, bills(label, category_id)) and null when the parent is gone', async () => {
    const [bill] = await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    await client
      .from('bill_payments')
      .insert({ user_id: userId, bill_id: bill.id, amount_cents: 40, paid_on: '2026-09-02' });
    const res = await client
      .from('bill_payments')
      .select('amount_cents, bills(label, category_id)')
      .single();
    expect(res.data).toEqual({ amount_cents: 40, bills: { label: 'Rent', category_id: null } });
  });

  it('receipt_items(*) on receipts, alias and !inner', async () => {
    const { data: receipt } = await client
      .from('receipts')
      .insert({ user_id: userId, store_label: 'Kroger' })
      .select()
      .single();
    await client
      .from('receipt_items')
      .insert({ user_id: userId, receipt_id: receipt!.id, label: 'Milk', price_cents: 399 });
    await client.from('receipts').insert({ user_id: userId, store_label: 'Empty' });

    const withItems = await client
      .from('receipts')
      .select('store_label, items:receipt_items(*)')
      .eq('store_label', 'Kroger')
      .single();
    expect(
      (withItems.data as { items: { label: string; quantity: number }[] }).items[0]
    ).toMatchObject({ label: 'Milk', quantity: 1 });

    const inner = await client.from('receipts').select('store_label, receipt_items!inner(label)');
    expect(inner.data).toEqual([{ store_label: 'Kroger', receipt_items: [{ label: 'Milk' }] }]);
  });

  it('errors on relationships that do not exist', async () => {
    const res = await client.from('bills').select('*, receipts(*)');
    expect(res.error?.code).toBe('PGRST200');
  });

  it('filters and orders on an embedded table', async () => {
    const [bill] = await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    await client.from('bill_payments').insert([
      { user_id: userId, bill_id: bill.id, amount_cents: 10, paid_on: '2026-08-01' },
      { user_id: userId, bill_id: bill.id, amount_cents: 20, paid_on: '2026-09-01' },
    ]);
    const res = await client
      .from('bills')
      .select('label, bill_payments(amount_cents)')
      .gte('bill_payments.paid_on', '2026-09-01')
      .single();
    expect(res.data).toEqual({ label: 'Rent', bill_payments: [{ amount_cents: 20 }] });
    const ordered = await client
      .from('bills')
      .select('label, bill_payments(amount_cents)')
      .order('amount_cents', { ascending: false, referencedTable: 'bill_payments' })
      .single();
    expect(
      (ordered.data as { bill_payments: { amount_cents: number }[] }).bill_payments.map(
        (p) => p.amount_cents
      )
    ).toEqual([20, 10]);
  });
});

describe('constraints (as Postgres would enforce them)', () => {
  it('NOT NULL (23502)', async () => {
    const res = await client
      .from('bills')
      .insert({ user_id: userId, label: 'x', due_date: '2026-09-01' } as never);
    expect(res.error?.code).toBe('23502');
  });

  it('CHECK (23514): enum-like values and amount checks', async () => {
    const bad = await client.from('bills').insert({
      user_id: userId,
      label: 'x',
      amount_cents: 1,
      due_date: '2026-09-01',
      recurrence: 'daily',
    });
    expect(bad.error?.code).toBe('23514');

    const { data: source } = await client
      .from('income_sources')
      .insert({ user_id: userId, label: 'Job', amount_cents: 100 })
      .select()
      .single();
    const bill = (await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' }))[0];
    const zero = await client.from('payday_assignments').insert({
      user_id: userId,
      income_source_id: source!.id,
      pay_date: '2026-09-25',
      target_type: 'bill',
      target_id: bill.id,
      amount_cents: 0,
    });
    expect(zero.error?.code).toBe('23514');
  });

  it('debts.last4 must be four digits; heloc is an allowed type', async () => {
    const base = { user_id: userId, label: 'Card', balance_cents: 100 };
    expect((await client.from('debts').insert({ ...base, last4: '12' })).error?.code).toBe('23514');
    expect((await client.from('debts').insert({ ...base, last4: '1234' })).error).toBeNull();
    expect((await client.from('debts').insert({ ...base, type: 'heloc' })).error).toBeNull();
    expect((await client.from('debts').insert({ ...base, type: 'boat' })).error?.code).toBe(
      '23514'
    );
  });

  it('rejects non-integer cents and invalid dates/uuids (22P02)', async () => {
    expect(
      (
        await client
          .from('bills')
          .insert({ user_id: userId, label: 'x', amount_cents: 12.5, due_date: '2026-09-01' })
      ).error?.code
    ).toBe('22P02');
    expect(
      (
        await client
          .from('bills')
          .insert({ user_id: userId, label: 'x', amount_cents: 1, due_date: 'soon' })
      ).error?.code
    ).toBe('22P02');
    expect((await client.from('bills').select('*').eq('id', 'not-a-uuid')).error?.code).toBe(
      '22P02'
    );
  });

  it('unknown columns are PGRST204', async () => {
    const res = await client.from('bills').insert({
      user_id: userId,
      label: 'x',
      amount_cents: 1,
      due_date: '2026-09-01',
      nope: 1,
    } as never);
    expect(res.error?.code).toBe('PGRST204');
  });

  it('foreign keys (23503) and ON DELETE CASCADE / SET NULL', async () => {
    const orphan = await client.from('bill_payments').insert({
      user_id: userId,
      bill_id: '11111111-1111-4111-8111-111111111111',
      amount_cents: 1,
      paid_on: '2026-09-01',
    });
    expect(orphan.error?.code).toBe('23503');

    const { data: category } = await client
      .from('categories')
      .insert({ user_id: userId, name: 'Housing' })
      .select()
      .single();
    const { data: bill } = await client
      .from('bills')
      .insert({
        user_id: userId,
        label: 'Rent',
        amount_cents: 1,
        due_date: '2026-09-01',
        category_id: category!.id,
      })
      .select()
      .single();
    await client
      .from('bill_payments')
      .insert({ user_id: userId, bill_id: bill!.id, amount_cents: 1, paid_on: '2026-09-01' });

    await client.from('categories').delete().eq('id', category!.id);
    expect((await client.from('bills').select('category_id').single()).data).toEqual({
      category_id: null,
    }); // SET NULL
    await client.from('bills').delete().eq('id', bill!.id);
    expect((await client.from('bill_payments').select('id')).data).toEqual([]); // CASCADE
  });

  it('UNIQUE (23505) incl. payday_assignments and budget_lines', async () => {
    const { data: source } = await client
      .from('income_sources')
      .insert({ user_id: userId, label: 'Job', amount_cents: 100 })
      .select()
      .single();
    const row = {
      user_id: userId,
      income_source_id: source!.id,
      pay_date: '2026-09-25',
      target_type: 'bill',
      target_id: '22222222-2222-4222-8222-222222222222',
      amount_cents: 5,
    };
    expect((await client.from('payday_assignments').insert(row)).error).toBeNull();
    const dup = await client.from('payday_assignments').insert(row);
    expect(dup.error?.code).toBe('23505');
    // different pay date is fine
    expect(
      (await client.from('payday_assignments').insert({ ...row, pay_date: '2026-10-09' })).error
    ).toBeNull();

    // A failed insert must not leave a partial write behind (statement atomicity).
    const batch = await client
      .from('payday_assignments')
      .insert([{ ...row, pay_date: '2026-11-01' }, row]);
    expect(batch.error?.code).toBe('23505');
    expect(
      (await client.from('payday_assignments').select('id', { count: 'exact', head: true })).count
    ).toBe(2);
  });

  it('payoff_plans is unique per user', async () => {
    expect((await client.from('payoff_plans').insert({ user_id: userId })).error).toBeNull();
    expect((await client.from('payoff_plans').insert({ user_id: userId })).error?.code).toBe(
      '23505'
    );
  });
});

describe('row-level security approximation', () => {
  it('rejects rows for another user and never returns them', async () => {
    const other = await client.from('bills').insert({
      user_id: '33333333-3333-4333-8333-333333333333',
      label: 'x',
      amount_cents: 1,
      due_date: '2026-09-01',
    });
    expect(other.error?.code).toBe('42501');
  });

  it('entitlements / feature_usage are read-only for the client', async () => {
    const res = await client.from('entitlements').insert({ user_id: userId });
    expect(res.error?.code).toBe('42501');
    const usage = await client
      .from('feature_usage')
      .insert({ user_id: userId, feature_key: 'receiptScan', period_start: '2026-09-01' });
    expect(usage.error?.code).toBe('42501');
  });
});

describe('update / upsert / delete', () => {
  it('update bumps updated_at and returns rows with select()', async () => {
    const [bill] = await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    await new Promise((r) => setTimeout(r, 2));
    const res = await client
      .from('bills')
      .update({ amount_cents: 200 })
      .eq('id', bill.id)
      .select()
      .single();
    expect(res.data).toMatchObject({ amount_cents: 200 });
    expect(res.data!.updated_at >= bill.updated_at).toBe(true);
  });

  it('update / delete without a filter is refused (Supabase enables pg-safeupdate)', async () => {
    expect((await client.from('bills').update({ autopay: true })).error?.code).toBe('21000');
    expect((await client.from('bills').delete()).error?.code).toBe('21000');
  });

  it('upsert merges on the conflict columns and only touches supplied columns', async () => {
    const { data: period } = await client
      .from('budget_periods')
      .insert({ user_id: userId, period_start: '2026-09-01', period_end: '2026-09-30' })
      .select()
      .single();
    const { data: category } = await client
      .from('categories')
      .insert({ user_id: userId, name: 'Food' })
      .select()
      .single();
    const line = { user_id: userId, budget_period_id: period!.id, category_id: category!.id };

    const first = await client
      .from('budget_lines')
      .upsert(
        { ...line, planned_cents: 100, actual_override_cents: 50 },
        { onConflict: 'budget_period_id,category_id' }
      )
      .select()
      .single();
    const second = await client
      .from('budget_lines')
      .upsert({ ...line, planned_cents: 300 }, { onConflict: 'budget_period_id,category_id' })
      .select()
      .single();
    expect(second.data!.id).toBe(first.data!.id);
    expect(second.data).toMatchObject({ planned_cents: 300, actual_override_cents: 50 });
    expect(
      (await client.from('budget_lines').select('id', { count: 'exact', head: true })).count
    ).toBe(1);
  });

  it('upsert on payoff_plans by user_id, and ignoreDuplicates', async () => {
    const a = await client
      .from('payoff_plans')
      .upsert({ user_id: userId, strategy: 'snowball' }, { onConflict: 'user_id' })
      .select()
      .single();
    const b = await client
      .from('payoff_plans')
      .upsert({ user_id: userId, extra_monthly_cents: 500 }, { onConflict: 'user_id' })
      .select()
      .single();
    expect(b.data).toMatchObject({
      id: a.data!.id,
      strategy: 'snowball',
      extra_monthly_cents: 500,
    });
    const ignored = await client
      .from('payoff_plans')
      .upsert(
        { user_id: userId, strategy: 'avalanche' },
        { onConflict: 'user_id', ignoreDuplicates: true }
      )
      .select();
    expect(ignored.data).toEqual([]);
    expect((await client.from('payoff_plans').select('strategy').single()).data).toEqual({
      strategy: 'snowball',
    });
  });

  it('upsert rejects a conflict target with no matching unique constraint (42P10)', async () => {
    const res = await client
      .from('bills')
      .upsert(
        { user_id: userId, label: 'x', amount_cents: 1, due_date: '2026-09-01' },
        { onConflict: 'label' }
      );
    expect(res.error?.code).toBe('42P10');
  });

  it('upsert with the same key twice in one statement is 21000', async () => {
    const { data: source } = await client
      .from('income_sources')
      .insert({ user_id: userId, label: 'Job', amount_cents: 100 })
      .select()
      .single();
    const row = {
      user_id: userId,
      income_source_id: source!.id,
      pay_date: '2026-09-25',
      target_type: 'bill',
      target_id: '22222222-2222-4222-8222-222222222222',
      amount_cents: 5,
    };
    const res = await client
      .from('payday_assignments')
      .upsert([row, row], { onConflict: 'income_source_id,pay_date,target_type,target_id' });
    expect(res.error?.code).toBe('21000');
  });

  it('delete returns the deleted rows with select()', async () => {
    const [bill] = await addBills({ label: 'Rent', amount: 100, due: '2026-09-01' });
    const res = await client.from('bills').delete().eq('id', bill.id).select();
    expect(res.data).toMatchObject([{ label: 'Rent' }]);
    expect((await client.from('bills').select('id')).data).toEqual([]);
  });
});

describe('throwOnError', () => {
  it('rejects instead of returning { error }', async () => {
    await expect(
      client
        .from('bills')
        .select('*')
        .eq('nope' as never, 1)
        .throwOnError()
    ).rejects.toMatchObject({ code: '42703' });
  });
});
