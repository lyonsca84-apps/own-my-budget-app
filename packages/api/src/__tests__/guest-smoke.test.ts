import * as api from '../index';
import { GUEST_USER_ID, type GuestClient } from '../guest';
import { TEST_NOW, seededClient } from '../guest/test-utils';

/**
 * Calls EVERY exported query function against the seeded guest client — reads
 * and writes — and asserts the demo data matches the approved design. The
 * final test fails if a new query function is exported without being covered
 * here, so the guest client can't silently fall behind the app.
 */

const covered = new Set<string>();
const uid = GUEST_USER_ID;
let client: GuestClient;
let ids: NonNullable<GuestClient['guest']['seedIds']>;

beforeEach(() => {
  client = seededClient();
  ids = client.guest.seedIds!;
});

function use<T>(name: keyof typeof api, run: () => Promise<T>): Promise<T> {
  covered.add(name);
  return run();
}

describe('seeded demo data matches the design', () => {
  it('account plumbing: Carol, free plan with the trial still available', async () => {
    const account = await use('getCurrentAccount', () => api.getCurrentAccount(client, uid));
    expect(account.profile.display_name).toBe('Carol');
    expect(account.profile.onboarding_completed_at).not.toBeNull();
    expect(account.entitlement).toMatchObject({
      plan_tier: 'free',
      status: 'active',
      trial_ends_at: null,
    });
    expect(account.settings.theme_preference).toBe('system');
    const profile = await use('getProfile', () => api.getProfile(client, uid));
    expect(profile.id).toBe(uid);
  });

  it('monthly budget categories and planned amounts', async () => {
    const categories = await use('listCategories', () => api.listCategories(client, uid));
    expect(categories.map((c) => c.name).sort()).toEqual([
      'Entertainment',
      'Food',
      'Health',
      'Housing',
      'Shopping',
      'Transportation',
      'Utilities',
    ]);
    const start = `${TEST_NOW.getFullYear()}-09-01`;
    const period = await use('findBudgetPeriod', () => api.findBudgetPeriod(client, uid, start));
    expect(period).not.toBeNull();
    const lines = await use('listBudgetLines', () => api.listBudgetLines(client, period!.id));
    const byName = new Map(categories.map((c) => [c.id, c.name]));
    const planned = Object.fromEntries(
      lines.map((l) => [byName.get(l.category_id), l.planned_cents / 100])
    );
    expect(planned).toEqual({
      Housing: 1800,
      Food: 600,
      Transportation: 300,
      Utilities: 215,
      Shopping: 160,
      Entertainment: 90,
      Health: 100,
    });
  });

  it('pay schedules', async () => {
    const sources = await use('listIncomeSources', () => api.listIncomeSources(client, uid));
    expect(sources.map((s) => [s.label, s.amount_cents / 100, s.frequency])).toEqual([
      ['Jamie · Retail Job', 1250, 'biweekly'],
      ['Sam · Freelance Design', 900, 'monthly'],
      ['Clifton Lyons · Penske', 2500, 'weekly'],
      ['carol Lyons · Northside Hospital.', 3000, 'biweekly'],
    ]);
    // relative to "today" (Sun 2026-09-20): Sep 26, Oct 1, Sep 25, Sep 25 — the design's paydays
    expect(sources.map((s) => s.next_pay_date)).toEqual([
      '2026-09-26',
      '2026-10-01',
      '2026-09-25',
      '2026-09-25',
    ]);
    const paychecks = await use('listPaychecks', () => api.listPaychecks(client, uid));
    expect(paychecks.length).toBeGreaterThan(10);
    expect(paychecks.every((p) => p.pay_date <= '2026-09-20')).toBe(true);
    expect(paychecks.filter((p) => p.is_assigned)).toHaveLength(1);
  });

  it('bills: rent paid, electric due, internet partial, insurance due, phone overdue, streaming paid', async () => {
    const bills = await use('listBillsWithPayments', () => api.listBillsWithPayments(client, uid));
    const state = Object.fromEntries(
      bills.map((b) => {
        const paid = b.bill_payments.reduce((s, p) => s + p.amount_cents, 0);
        const due = new Date(`${b.due_date}T23:59:59`);
        const status =
          paid >= b.amount_cents
            ? 'paid'
            : due < TEST_NOW
              ? 'overdue'
              : paid > 0
                ? 'partial'
                : 'due';
        return [b.label, [b.amount_cents / 100, paid / 100, status]];
      })
    );
    expect(state).toEqual({
      Rent: [1450, 1450, 'paid'],
      Electric: [145, 0, 'due'],
      Internet: [70, 35, 'partial'],
      'Car Insurance': [120, 0, 'due'],
      Phone: [85, 0, 'overdue'],
      'Streaming Bundle': [24, 24, 'paid'],
    });
    expect(
      bills
        .filter((b) => b.reminder_enabled)
        .map((b) => b.label)
        .sort()
    ).toEqual(['Car Insurance', 'Electric', 'Rent']);
    expect(bills.map((b) => b.due_date)).toEqual([...bills.map((b) => b.due_date)].sort()); // ordered by due_date
  });

  it('credit cards: 11 cards, $34,197 owed, $779 minimums', async () => {
    const debts = await use('listDebtsWithPayments', () => api.listDebtsWithPayments(client, uid));
    const cards = debts.filter((d) => d.type === 'creditCard');
    expect(cards.map((c) => c.label)).toEqual([
      'Civic Legacy Credit Card',
      'Civic Classic Credit Card',
      'Chase',
      'AA Citi',
      'LGE Credit Card',
      'Discover — Husband',
      "Sam's Club",
      'QVC',
      'Belk',
      'Apple Credit — Carol',
      'Apple Credit — Husband',
    ]);
    expect(Math.round(cards.reduce((s, c) => s + c.balance_cents, 0) / 100)).toBe(34197);
    expect(Math.round(cards.reduce((s, c) => s + c.minimum_payment_cents, 0) / 100)).toBe(779);
    expect(cards[0]).toMatchObject({
      issuer: 'Bank of America',
      last4: '4821',
      balance_cents: 148141,
    });
    expect(cards[3]).toMatchObject({
      label: 'AA Citi',
      balance_cents: 624438,
      minimum_payment_cents: 28125,
    });
    expect(cards.every((c) => c.credit_limit_cents === null)).toBe(true);
  });

  it('loans: $404,600 owed, $3,700 a month, $2,500 paid', async () => {
    const debts = await api.listDebtsWithPayments(client, uid);
    const loans = debts.filter((d) => d.type !== 'creditCard');
    expect(loans.map((l) => l.label)).toEqual([
      'Primary Mortgage',
      'Second Mortgage',
      'HELOC',
      'Discover Personal Loan',
      'Affirm',
      'Other Loan',
    ]);
    expect(loans.reduce((s, l) => s + l.balance_cents, 0) / 100).toBe(404600);
    expect(loans.reduce((s, l) => s + l.minimum_payment_cents, 0) / 100).toBe(3700);
    expect(
      loans.flatMap((l) => l.debt_payments).reduce((s, p) => s + p.amount_cents, 0) / 100
    ).toBe(2500);
    const nonMortgageOriginal = loans
      .filter((l) => l.type !== 'mortgage')
      .reduce((s, l) => s + (l.original_balance_cents ?? 0), 0);
    expect(nonMortgageOriginal / 100).toBe(67100);
    expect(loans.find((l) => l.label === 'HELOC')).toMatchObject({
      type: 'heloc',
      apr_basis_points: 750,
    });
    const plan = await use('getPayoffPlan', () => api.getPayoffPlan(client, uid));
    expect(plan).toMatchObject({ strategy: 'snowball', extra_monthly_cents: 2500 });
  });

  it('savings goals, challenge, deposits and the badge signals', async () => {
    const goals = await use('listSavingsGoals', () => api.listSavingsGoals(client, uid));
    // Oldest first (order by created_at): the app sorts challenges/completed goals itself.
    expect(goals.map((g) => [g.label, g.saved_cents / 100, g.target_cents / 100])).toEqual([
      ['Emergency Fund', 3200, 6000],
      ['New Laptop', 1200, 1200],
      ['Family Vacation', 900, 2500],
      ['52-Week Money Challenge', 15, 1378],
    ]);
    expect(goals.reduce((s, g) => s + g.saved_cents, 0) / 100).toBe(5315);

    const challenges = await use('listSavingsChallenges', () =>
      api.listSavingsChallenges(client, uid)
    );
    expect(challenges).toHaveLength(1);
    expect(challenges[0]).toMatchObject({ goal_id: ids.goals.challenge, total_weeks: 52 });

    const activity = await use('listUserGoalActivity', () => api.listUserGoalActivity(client, uid));
    for (const goal of goals) {
      const sum = activity
        .filter((a) => a.goal_id === goal.id)
        .reduce((s, a) => s + a.amount_cents, 0);
      expect(sum).toBe(goal.saved_cents);
    }
    expect(activity.every((a, i) => i === 0 || activity[i - 1].occurred_on >= a.occurred_on)).toBe(
      true
    );
    // No deposits yet this month (design: "$0 — No deposits yet this month").
    expect(activity.filter((a) => a.occurred_on >= '2026-09-01')).toEqual([]);

    const emergency = await use('listGoalActivity', () =>
      api.listGoalActivity(client, ids.goals.emergency)
    );
    expect(emergency.map((a) => [a.occurred_on, a.amount_cents / 100, a.note])).toEqual([
      ['2026-07-05', 1200, 'Jamie · Weekend Gig'],
      ['2026-06-01', 2000, 'Jamie · Retail Job'],
    ]);

    const signals = await use('getSavingsInsightSignals', () =>
      api.getSavingsInsightSignals(client, uid, {
        monthStart: '2026-09-01',
        nextMonthStart: '2026-10-01',
        trackingSince: '2026-09-14',
      })
    );
    expect(signals).toMatchObject({
      hasBudgetPlan: true,
      billsTotal: 6,
      billsPaid: 2,
      hasPaidOffDebt: false,
      hasAssignedPaycheck: true,
      trackedDays: 7,
    });
  });

  it('groceries and receipts exist', async () => {
    const list = await use('getOrCreateDefaultGroceryList', () =>
      api.getOrCreateDefaultGroceryList(client, uid)
    );
    expect(list.id).toBe(ids.groceryList);
    const items = await use('listGroceryItems', () => api.listGroceryItems(client, list.id));
    expect(items.length).toBeGreaterThan(5);
    expect(items.some((i) => i.is_checked)).toBe(true);
    const receipts = await use('listReceipts', () => api.listReceipts(client, uid));
    expect(receipts.length).toBeGreaterThanOrEqual(5);
    expect(receipts[0].purchased_on! >= receipts[1].purchased_on!).toBe(true);
    const inRange = await use('listReceiptsInRange', () =>
      api.listReceiptsInRange(client, uid, { fromDate: '2026-09-01', toDate: '2026-09-30' })
    );
    expect(inRange.length).toBeGreaterThan(0);
    expect(
      inRange.every((r) => r.purchased_on! >= '2026-09-01' && r.purchased_on! <= '2026-09-30')
    ).toBe(true);
    const receiptItems = await use('listReceiptItems', () =>
      api.listReceiptItems(client, receipts[0].id)
    );
    const subtotal = receiptItems.reduce((s, i) => s + i.price_cents * i.quantity, 0);
    expect(subtotal).toBe(receipts[0].subtotal_cents);
  });

  it('reports read models', async () => {
    const bills = await use('listBillPaymentsForReports', () =>
      api.listBillPaymentsForReports(client, uid)
    );
    expect(bills.map((b) => b.bill_label).sort()).toEqual(['Internet', 'Rent', 'Streaming Bundle']);
    expect(bills.find((b) => b.bill_label === 'Rent')!.category_id).toBe(ids.categories.housing);
    const debts = await use('listDebtPaymentsForReports', () =>
      api.listDebtPaymentsForReports(client, uid)
    );
    expect(debts).toEqual([
      expect.objectContaining({ debt_label: 'Primary Mortgage', amount_cents: 250000 }),
    ]);
    const goals = await use('listGoalActivityForReports', () =>
      api.listGoalActivityForReports(client, uid, { fromDate: '2026-06-01', toDate: '2026-06-30' })
    );
    expect(goals.filter((g) => g.goal_label === 'Emergency Fund')).toEqual([
      expect.objectContaining({ amount_cents: 200000, kind: 'deposit' }),
    ]);
    const transactions = await use('listTransactions', () =>
      api.listTransactions(client, uid, { fromDate: '2026-09-14' })
    );
    expect(new Set(transactions.map((t) => t.occurred_on)).size).toBe(7);
  });

  it('accounts, notification prefs, feature usage', async () => {
    const accounts = await use('listAccounts', () => api.listAccounts(client, uid));
    expect(accounts.map((a) => a.label)).toEqual(['Checking', 'Savings']);
    const prefs = await use('getNotificationPreferences', () =>
      api.getNotificationPreferences(client, uid)
    );
    expect(prefs).toMatchObject({ bill_reminders_enabled: true, bill_reminder_days_before: 3 });
    expect(
      await use('getFeatureUsageCount', () =>
        api.getFeatureUsageCount(client, uid, 'receiptScan', '2026-09-01')
      )
    ).toBe(0);
  });

  it('is deterministic: two clients at the same time hold identical data', () => {
    const a = seededClient();
    const b = seededClient();
    for (const table of [
      'bills',
      'debts',
      'savings_goals',
      'goal_activity',
      'paychecks',
      'receipt_items',
    ]) {
      expect(a.guest.rows(table)).toEqual(b.guest.rows(table));
    }
  });

  it('seed dates follow "today", so states stay right when the clock moves', async () => {
    const later = new Date(2027, 2, 9, 12, 0, 0);
    const shifted = (await import('../guest')).createGuestClient({ now: () => later });
    const bills = await api.listBillsWithPayments(shifted, uid);
    const phone = bills.find((b) => b.label === 'Phone')!;
    expect(phone.due_date).toBe('2027-03-03'); // 6 days before "today", so still overdue
    const rent = bills.find((b) => b.label === 'Rent')!;
    expect(rent.due_date).toBe('2027-03-01');
    expect(rent.bill_payments[0].paid_on).toBe('2027-03-01');
    const sources = await api.listIncomeSources(shifted, uid);
    expect(sources.find((s) => s.label.includes('Penske'))!.next_pay_date).toBe('2027-03-14');
  });

  it('reset restores the seed after writes', async () => {
    await api.createBill(client, {
      user_id: uid,
      label: 'Extra',
      amount_cents: 1,
      due_date: '2026-09-30',
    });
    await api.archiveDebt(client, ids.cards[0]);
    client.guest.reset();
    expect(await api.listBillsWithPayments(client, uid)).toHaveLength(6);
    expect(await api.listDebtsWithPayments(client, uid)).toHaveLength(17);
  });
});

describe('write paths, on the same code as a signed-in user', () => {
  it('profile + notification preferences', async () => {
    const p = await use('updateProfile', () =>
      api.updateProfile(client, uid, { display_name: 'Caro' })
    );
    expect(p.display_name).toBe('Caro');
    const n = await use('updateNotificationPreferences', () =>
      api.updateNotificationPreferences(client, uid, { bill_reminder_days_before: 5 })
    );
    expect(n.bill_reminder_days_before).toBe(5);
  });

  it('profile photo and logo: upload, replace (old file removed), remove', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const nameBefore = (await api.getProfile(client, uid)).display_name;
    const first = await use('uploadProfileImage', () =>
      api.uploadProfileImage(client, uid, 'logo', png, 'image/png', 'png')
    );
    expect(first.logo_path).toMatch(new RegExp(`^${uid}/logo-\\d+\\.png$`));
    const url = await use('getProfileImageUrl', () =>
      api.getProfileImageUrl(client, first.logo_path!)
    );
    expect(url).toContain(first.logo_path!);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await api.uploadProfileImage(client, uid, 'logo', png, 'image/png', 'png');
    expect(second.logo_path).not.toBe(first.logo_path);
    const { data: files } = await client.storage.from(api.PROFILE_IMAGES_BUCKET).list(uid);
    const names = (files ?? []).map((f: { name: string }) => f.name);
    expect(names.some((n: string) => n.endsWith(second.logo_path!.split('/')[1]))).toBe(true);
    expect(names.some((n: string) => n.endsWith(first.logo_path!.split('/')[1]))).toBe(false);

    const cleared = await use('removeProfileImage', () =>
      api.removeProfileImage(client, uid, 'logo')
    );
    expect(cleared.logo_path).toBeNull();
    // Only the logo changed; the rest of the profile is untouched.
    expect(cleared.display_name).toBe(nameBefore);
  });

  it('accounts', async () => {
    const created = await use('createAccount', () =>
      api.createAccount(client, { user_id: uid, label: 'Cash', type: 'cash' })
    );
    expect(created.balance_cents).toBe(0);
    expect(await api.listAccounts(client, uid)).toHaveLength(3);
  });

  it('bills: create, pay, edit, plan, archive', async () => {
    const bill = await use('createBill', () =>
      api.createBill(client, {
        user_id: uid,
        label: 'Gym',
        amount_cents: 3500,
        due_date: '2026-09-28',
      })
    );
    expect(bill).toMatchObject({ recurrence: 'monthly', reminder_enabled: true });
    const payment = await use('recordBillPayment', () =>
      api.recordBillPayment(client, {
        user_id: uid,
        bill_id: ids.bills.electric,
        amount_cents: 14500,
        paid_on: '2026-09-20',
      })
    );
    expect(payment.amount_cents).toBe(14500);
    const updated = await use('updateBill', () =>
      api.updateBill(client, bill.id, { reminder_enabled: false })
    );
    expect(updated.reminder_enabled).toBe(false);
    expect((await use('getBill', () => api.getBill(client, bill.id))).label).toBe('Gym');

    const withPayments = await api.listBillsWithPayments(client, uid);
    expect(withPayments.find((b) => b.id === ids.bills.electric)!.bill_payments).toHaveLength(1);

    await use('archiveBill', () => api.archiveBill(client, bill.id));
    expect((await api.listBillsWithPayments(client, uid)).some((b) => b.id === bill.id)).toBe(
      false
    );
  });

  it('replacePaydayPlan: split, merge same payday, replace, clear; assignments feed listPaydayAssignments', async () => {
    const jamie = ids.incomeSources.jamie;
    const clifton = ids.incomeSources.clifton;
    const target = { type: 'bill' as const, id: ids.bills.carInsurance };
    await use('replacePaydayPlan', () =>
      api.replacePaydayPlan(client, uid, target, [
        { incomeSourceId: jamie, payDate: '2026-09-26', amountCents: 6000 },
        { incomeSourceId: clifton, payDate: '2026-09-25', amountCents: 4000 },
        { incomeSourceId: clifton, payDate: '2026-09-25', amountCents: 2000 }, // merges into the row above
      ])
    );
    let plan = await use('listPaydayAssignments', () => api.listPaydayAssignments(client, uid));
    expect(
      plan.map((a) => [a.income_source_id === jamie ? 'jamie' : 'clifton', a.amount_cents])
    ).toEqual([
      ['clifton', 6000],
      ['jamie', 6000],
    ]);

    await api.replacePaydayPlan(client, uid, target, [
      { incomeSourceId: jamie, payDate: '2026-09-26', amountCents: 12000 },
    ]);
    plan = await api.listPaydayAssignments(client, uid);
    expect(plan.map((a) => a.amount_cents)).toEqual([12000]);

    await api.replacePaydayPlan(client, uid, target, []);
    expect(await api.listPaydayAssignments(client, uid)).toEqual([]);
  });

  it('paycheck assignment helpers', async () => {
    const created = await use('createPaycheck', () =>
      api.createPaycheck(client, {
        user_id: uid,
        amount_cents: 125000,
        pay_date: '2026-09-20',
        income_source_id: ids.incomeSources.jamie,
      })
    );
    expect(created.is_assigned).toBe(false);
    await use('markPaycheckAssigned', () => api.markPaycheckAssigned(client, created.id));
    expect((await use('getPaycheck', () => api.getPaycheck(client, created.id))).is_assigned).toBe(
      true
    );

    const assignment = await use('assignPaymentToPayday', () =>
      api.assignPaymentToPayday(client, {
        user_id: uid,
        income_source_id: ids.incomeSources.jamie,
        pay_date: '2026-09-26',
        target_type: 'debt',
        target_id: ids.cards[0],
        amount_cents: 5000,
      })
    );
    // same key again updates in place rather than adding a row
    const again = await api.assignPaymentToPayday(client, { ...assignment, amount_cents: 7500 });
    expect(again.id).toBe(assignment.id);
    expect((await api.listPaydayAssignments(client, uid)).map((a) => a.amount_cents)).toEqual([
      7500,
    ]);
    await use('removePaydayAssignment', () => api.removePaydayAssignment(client, assignment.id));
    expect(await api.listPaydayAssignments(client, uid)).toEqual([]);
  });

  it('onboarding income retries neither duplicate sources nor overwrite later edits', async () => {
    const sources = [
      {
        id: '1d931172-5555-4b3d-8355-e72c0fa17d40',
        label: 'Take-home pay',
        amount_cents: 85000,
        frequency: 'weekly' as const,
        next_pay_date: '2026-09-25',
      },
      {
        id: '2d931172-5555-4b3d-8355-e72c0fa17d40',
        label: 'Estimated income',
        amount_cents: 10000,
        frequency: 'monthly' as const,
        is_variable: true,
      },
    ];
    const before = (await api.listIncomeSources(client, uid)).length;
    await use('saveOnboardingIncomeSources', () =>
      api.saveOnboardingIncomeSources(client, uid, sources)
    );
    await api.updateIncomeSource(client, sources[0].id, { amount_cents: 90000 });
    await api.saveOnboardingIncomeSources(client, uid, sources);
    expect((await api.listIncomeSources(client, uid)).length).toBe(before + 2);
    expect((await api.getIncomeSource(client, sources[0].id)).amount_cents).toBe(90000);
    expect((await api.getIncomeSource(client, sources[1].id)).is_variable).toBe(true);
    await api.saveOnboardingIncomeSources(client, uid, []);
    expect((await api.listIncomeSources(client, uid)).length).toBe(before + 2);
  });

  it('income sources', async () => {
    const created = await use('createIncomeSource', () =>
      api.createIncomeSource(client, {
        user_id: uid,
        label: 'Side gig',
        amount_cents: 20000,
        frequency: 'variable',
      })
    );
    expect(
      (await use('getIncomeSource', () => api.getIncomeSource(client, created.id))).label
    ).toBe('Side gig');
    const paused = await use('updateIncomeSource', () =>
      api.updateIncomeSource(client, created.id, { archived_at: new Date().toISOString() })
    );
    expect(paused.archived_at).not.toBeNull();
    expect((await api.listIncomeSources(client, uid)).some((s) => s.id === created.id)).toBe(false);
    expect(
      (await api.listIncomeSources(client, uid, { includeArchived: true })).some(
        (s) => s.id === created.id
      )
    ).toBe(true);
  });

  it('categories and budget lines', async () => {
    const category = await use('createCategory', () =>
      api.createCategory(client, { user_id: uid, name: 'Pets' })
    );
    await use('renameCategory', () => api.renameCategory(client, category.id, 'Pet Care'));
    expect((await api.listCategories(client, uid)).map((c) => c.name)).toContain('Pet Care');
    const october = await use('getOrCreateBudgetPeriod', () =>
      api.getOrCreateBudgetPeriod(client, uid, '2026-10-01', '2026-10-31')
    );
    expect((await api.getOrCreateBudgetPeriod(client, uid, '2026-10-01', '2026-10-31')).id).toBe(
      october.id
    );
    const line = await use('upsertBudgetLine', () =>
      api.upsertBudgetLine(client, {
        user_id: uid,
        budget_period_id: october.id,
        category_id: category.id,
        planned_cents: 5000,
      })
    );
    const edited = await api.upsertBudgetLine(client, {
      user_id: uid,
      budget_period_id: october.id,
      category_id: category.id,
      actual_override_cents: 1200,
    });
    expect(edited).toMatchObject({ id: line.id, planned_cents: 5000, actual_override_cents: 1200 });
    expect(await api.listBudgetLines(client, october.id)).toHaveLength(1);
    await use('archiveCategory', () => api.archiveCategory(client, category.id));
    expect((await api.listCategories(client, uid)).some((c) => c.id === category.id)).toBe(false);
  });

  it('transactions', async () => {
    const t = await use('createTransaction', () =>
      api.createTransaction(client, {
        user_id: uid,
        amount_cents: -1250,
        occurred_on: '2026-09-20',
        label: 'Lunch',
        category_id: ids.categories.food,
      })
    );
    const list = await api.listTransactions(client, uid, {
      fromDate: '2026-09-20',
      toDate: '2026-09-20',
    });
    expect(list.map((x) => x.id)).toContain(t.id);
    expect(list).toHaveLength(2); // plus the seeded coffee from today
  });

  it('debts: pay (balance drops atomically), edit, archive, payoff plan', async () => {
    const card = ids.cards[2]; // Chase
    const before = await use('getDebt', () => api.getDebt(client, card));
    const payment = await use('recordDebtPayment', () =>
      api.recordDebtPayment(client, { debtId: card, amountCents: 50000, paidOn: '2026-09-20' })
    );
    expect(payment).toMatchObject({ debt_id: card, amount_cents: 50000 });
    expect((await api.getDebt(client, card)).balance_cents).toBe(before.balance_cents - 50000);
    const listed = (await api.listDebtsWithPayments(client, uid)).find((d) => d.id === card)!;
    expect(listed.debt_payments).toEqual([{ amount_cents: 50000, paid_on: '2026-09-20' }]);

    const created = await use('createDebt', () =>
      api.createDebt(client, { user_id: uid, label: 'New Card', balance_cents: 10000 })
    );
    expect(created).toMatchObject({
      type: 'creditCard',
      card_text_mode: 'auto',
      apr_basis_points: 0,
    });
    const updated = await use('updateDebt', () =>
      api.updateDebt(client, created.id, { credit_limit_cents: 500000, last4: '9999' })
    );
    expect(updated.credit_limit_cents).toBe(500000);
    await expect(api.updateDebt(client, created.id, { last4: 'abc' })).rejects.toMatchObject({
      code: '23514',
    });
    await use('archiveDebt', () => api.archiveDebt(client, created.id));
    expect((await api.listDebtsWithPayments(client, uid)).some((d) => d.id === created.id)).toBe(
      false
    );

    const saved = await use('savePayoffPlan', () =>
      api.savePayoffPlan(client, uid, { strategy: 'avalanche', card_goal_target_cents: 100000 })
    );
    expect(saved).toMatchObject({
      strategy: 'avalanche',
      extra_monthly_cents: 2500,
      card_goal_target_cents: 100000,
    });
    expect(client.guest.rows('payoff_plans')).toHaveLength(1);
  });

  it('savings: goal, challenge, deposit/withdraw, edit, archive', async () => {
    const goal = await use('createSavingsGoal', () =>
      api.createSavingsGoal(client, { user_id: uid, label: 'Bike', target_cents: 90000 })
    );
    expect(goal.saved_cents).toBe(0);
    const challenge = await use('createSavingsChallenge', () =>
      api.createSavingsChallenge(client, { user_id: uid, goal_id: goal.id })
    );
    expect(challenge).toMatchObject({
      challenge_type: 'classic_ascending',
      cadence: 'weekly',
      total_weeks: 52,
    });

    const deposit = await use('recordGoalActivity', () =>
      api.recordGoalActivity(client, {
        goalId: goal.id,
        amountCents: 2500,
        kind: 'deposit',
        occurredOn: '2026-09-20',
        note: 'Birthday money',
      })
    );
    expect(deposit).toMatchObject({ kind: 'deposit', note: 'Birthday money' });
    expect(
      (await use('getSavingsGoal', () => api.getSavingsGoal(client, goal.id))).saved_cents
    ).toBe(2500);
    await api.recordGoalActivity(client, {
      goalId: goal.id,
      amountCents: 1000,
      kind: 'withdrawal',
      occurredOn: '2026-09-20',
    });
    expect((await api.getSavingsGoal(client, goal.id)).saved_cents).toBe(1500);
    expect(await api.listGoalActivity(client, goal.id)).toHaveLength(2);

    // Deposits land in "this month" — the monthly stat and the mission progress read these.
    expect(await api.listUserGoalActivity(client, uid, 1)).toHaveLength(1);

    const edited = await use('updateSavingsGoal', () =>
      api.updateSavingsGoal(client, goal.id, { label: 'E-Bike' })
    );
    expect(edited.label).toBe('E-Bike');
    await use('archiveSavingsGoal', () =>
      api.archiveSavingsGoal(client, goal.id, new Date().toISOString())
    );
    expect((await api.listSavingsGoals(client, uid)).some((g) => g.id === goal.id)).toBe(false);
  });

  it('savings design: challenge weeks, edit/delete a deposit, pause, new goal fields', async () => {
    const goal = await api.createSavingsGoal(client, {
      user_id: uid,
      label: 'Trip',
      target_cents: 100000,
      category: 'Vacation',
      frequency: 'weekly',
      start_date: '2026-09-01',
      planned_deposit_cents: 5000,
      account_label: 'Ally',
      color: '#01ACD3',
      notes: 'Beach',
    });
    expect(goal).toMatchObject({
      category: 'Vacation',
      frequency: 'weekly',
      planned_deposit_cents: 5000,
      account_label: 'Ally',
      paused_at: null,
    });
    const paused = await api.updateSavingsGoal(client, goal.id, {
      paused_at: '2026-09-20T12:00:00.000Z',
    });
    expect(paused.paused_at).not.toBeNull();

    const challengeGoal = await api.createSavingsGoal(client, {
      user_id: uid,
      label: 'Challenge',
      target_cents: 137800,
      is_challenge: true,
    });
    const challenge = await api.createSavingsChallenge(client, {
      user_id: uid,
      goal_id: challengeGoal.id,
    });
    expect(challenge).toMatchObject({ multiplier: 1, block_notes: {}, notes: null });
    const week = await use('recordChallengeWeek', () =>
      api.recordChallengeWeek(client, {
        goalId: challengeGoal.id,
        week: 3,
        amountCents: 300,
        occurredOn: '2026-09-20',
      })
    );
    expect(week).toMatchObject({ challenge_week: 3, note: 'Week 3', kind: 'deposit' });
    await expect(
      api.recordChallengeWeek(client, {
        goalId: challengeGoal.id,
        week: 3,
        amountCents: 300,
        occurredOn: '2026-09-20',
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('already recorded') });
    const patched = await use('updateSavingsChallenge', () =>
      api.updateSavingsChallenge(client, challenge.id, {
        multiplier: 5,
        block_notes: { '1': 'Started strong' },
      })
    );
    expect(patched).toMatchObject({ multiplier: 5, block_notes: { '1': 'Started strong' } });

    const edited = await use('updateGoalActivity', () =>
      api.updateGoalActivity(client, {
        activityId: week.id,
        amountCents: 500,
        occurredOn: '2026-09-19',
        note: 'Bonus week',
      })
    );
    expect(edited).toMatchObject({ amount_cents: 500, occurred_on: '2026-09-19' });
    expect((await api.getSavingsGoal(client, challengeGoal.id)).saved_cents).toBe(500);
    await use('deleteGoalActivity', () => api.deleteGoalActivity(client, week.id));
    expect((await api.getSavingsGoal(client, challengeGoal.id)).saved_cents).toBe(0);
    expect(await api.listGoalActivity(client, challengeGoal.id)).toHaveLength(0);
  });

  it('isMissingSavingsSchemaError recognises a database without the design migration', () => {
    covered.add('isMissingSavingsSchemaError');
    expect(api.isMissingSavingsSchemaError({ code: 'PGRST204', message: 'x' })).toBe(true);
    expect(api.isMissingSavingsSchemaError({ code: '42703', message: 'x' })).toBe(true);
    expect(
      api.isMissingSavingsSchemaError({ message: "Could not find the 'paused_at' column" })
    ).toBe(true);
    expect(api.isMissingSavingsSchemaError({ code: '23505', message: 'duplicate' })).toBe(false);
    expect(api.isMissingSavingsSchemaError(null)).toBe(false);
  });

  it('groceries', async () => {
    const list = await api.getOrCreateDefaultGroceryList(client, uid);
    const added = await use('addGroceryItems', () =>
      api.addGroceryItems(client, uid, list.id, ['Tea', 'Honey'])
    );
    expect(added.map((i) => i.label)).toEqual(['Tea', 'Honey']);
    expect(await api.addGroceryItems(client, uid, list.id, [])).toEqual([]);
    await use('toggleGroceryItem', () => api.toggleGroceryItem(client, added[0].id, true));
    let items = await api.listGroceryItems(client, list.id);
    expect(items.find((i) => i.id === added[0].id)!.is_checked).toBe(true);
    await use('deleteGroceryItem', () => api.deleteGroceryItem(client, added[1].id));
    await use('clearCheckedGroceryItems', () => api.clearCheckedGroceryItems(client, list.id));
    items = await api.listGroceryItems(client, list.id);
    expect(items.some((i) => i.is_checked)).toBe(false);
    expect(items.some((i) => i.label === 'Honey')).toBe(false);
  });

  it('a fresh signed-in-style empty account still creates its grocery list on demand', async () => {
    for (const list of client.guest.rows('grocery_lists')) {
      await client
        .from('grocery_lists')
        .delete()
        .eq('id', list.id as string);
    }
    const created = await api.getOrCreateDefaultGroceryList(client, uid);
    expect(created.label).toBe('Grocery List');
  });

  it('receipts: save with items, then read back', async () => {
    const receipt = await use('saveReceipt', () =>
      api.saveReceipt(client, {
        user_id: uid,
        store_label: 'Publix',
        purchased_on: '2026-09-20',
        subtotal_cents: 1000,
        tax_cents: 70,
        total_cents: 1070,
        image_storage_path: null,
        items: [
          { label: 'Bread', category: 'Bakery', price_cents: 500, quantity: 1 },
          { label: 'Apples', category: 'Produce', price_cents: 250, quantity: 2 },
        ],
      })
    );
    expect(receipt.ai_extraction_status).toBe('confirmed');
    const items = await api.listReceiptItems(client, receipt.id);
    expect(items.map((i) => [i.label, i.quantity])).toEqual([
      ['Bread', 1],
      ['Apples', 2],
    ]);
  });
});

describe('Edge Functions in guest mode', () => {
  it('fail with a friendly EdgeFunctionError, never a throw from the client', async () => {
    const calls: [keyof typeof api, () => Promise<unknown>][] = [
      ['scanReceipt', () => api.scanReceipt(client, 'abc', 'image/png')],
      ['scanPantry', () => api.scanPantry(client, 'abc', 'image/png')],
      ['sendBudgetBuddyMessage', () => api.sendBudgetBuddyMessage(client, 'hi', [])],
      ['deleteAccount', () => api.deleteAccount(client)],
      [
        'createCheckoutSession',
        () =>
          api.createCheckoutSession(client, {
            plan: 'guided',
            interval: 'monthly',
            successUrl: 'x',
            cancelUrl: 'y',
          }),
      ],
      ['createPortalSession', () => api.createPortalSession(client, 'x')],
      ['routeIntent', () => api.routeIntent(client, 'I paid Georgia Power $75 yesterday.')],
      [
        'proposeBillPayment',
        () => api.proposeBillPayment(client, 'I paid Georgia Power $75 yesterday.'),
      ],
      // Budget Buddy voice is account-only: a guest never reaches a paid provider.
      ['getBuddyVoiceStatus', () => api.getBuddyVoiceStatus(client)],
      [
        'transcribeBuddyAudio',
        () =>
          api.transcribeBuddyAudio(client, {
            requestId: 'request-0001',
            audioBase64: 'GkXfow==',
            durationMs: 1000,
          }),
      ],
      [
        'synthesizeBuddySpeech',
        () => api.synthesizeBuddySpeech(client, { requestId: 'request-0001', text: 'Hi.' }),
      ],
    ];
    for (const [name, call] of calls) {
      covered.add(name);
      await expect(call()).rejects.toBeInstanceOf(api.EdgeFunctionError);
      await expect(call()).rejects.toMatchObject({ code: 'guest_mode' });
    }
    await expect(api.scanReceipt(client, 'abc', 'image/png')).rejects.toThrow(/free account/i);
  });

  it('can be stubbed per function', async () => {
    client.guest.setFunctionHandler('budget-buddy-chat', (body) => ({
      data: { reply: `echo: ${(body as { message: string }).message}` },
    }));
    expect(await api.sendBudgetBuddyMessage(client, 'hello', [])).toBe('echo: hello');
  });
});

describe('coverage guard', () => {
  it('every exported query function has a smoke test above', () => {
    const notQueries = new Set([
      'createSupabaseClient',
      'createGuestClient',
      'seedGuestData',
      'EdgeFunctionError',
    ]);
    const exported = Object.entries(api)
      .filter(([name, value]) => typeof value === 'function' && !notQueries.has(name))
      .map(([name]) => name);
    const missing = exported.filter((name) => !covered.has(name));
    // Individual `it` blocks populate `covered`; this file's earlier tests must have run first.
    expect(missing).toEqual([]);
  });
});
