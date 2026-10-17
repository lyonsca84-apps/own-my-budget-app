import { Database, type Ctx } from './db';
import { addDays, dateAt, formatDate, monthEnd, monthStart, timestampAt } from './dates';
import type { Row } from './values';

/**
 * The demo household guests explore — matches the approved design screenshots
 * (design/App Screenshots/*). Everything is **relative to `now`**, so the
 * current month, the upcoming paydays and the overdue/partial/paid bill states
 * always look right no matter when it's loaded. Fully deterministic: the same
 * `now` always produces the same rows with the same ids.
 *
 * Money is integer cents. "Design says" comments point at the screenshot a
 * value comes from.
 */

/** Stable id for the fake user every guest acts as. */
export const GUEST_USER_ID = '00000000-0000-4000-8000-000000000001';

export interface SeedIds {
  userId: string;
  accounts: { checking: string; savings: string };
  categories: Record<
    'housing' | 'food' | 'transportation' | 'utilities' | 'shopping' | 'entertainment' | 'health',
    string
  >;
  incomeSources: { jamie: string; sam: string; clifton: string; carol: string };
  bills: Record<'rent' | 'electric' | 'internet' | 'carInsurance' | 'phone' | 'streaming', string>;
  /** Credit cards in display order. */
  cards: string[];
  /** Loans/mortgages in display order (primary mortgage first). */
  loans: {
    primaryMortgage: string;
    secondMortgage: string;
    heloc: string;
    discover: string;
    affirm: string;
    other: string;
  };
  goals: { challenge: string; emergency: string; vacation: string; laptop: string };
  groceryList: string;
}

const seedIdFor = (n: number) => `5eed0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const cents = (dollars: number) => Math.round(dollars * 100);

export function seedGuestData(db: Database, options: { userId: string; now: Date }): SeedIds {
  const { userId, now } = options;
  const ctx: Ctx = { role: 'service', userId };
  let counter = 0x100;
  let stampSeconds = 0;
  const nextId = () => seedIdFor(counter++);
  /** Deterministic, strictly increasing created_at so `order('created_at')` keeps insertion order. */
  const stamp = (daysAgo: number) =>
    timestampAt(now, -daysAgo, 9, Math.floor(stampSeconds / 60) % 60, stampSeconds++ % 60);
  const ins = (table: string, values: Row): Row =>
    db.insertRow(table, { id: nextId(), ...values }, ctx);
  const own = (table: string, values: Row): Row => ins(table, { user_id: userId, ...values });

  const thisMonthStart = monthStart(now);
  const firstOfMonth = formatDate(thisMonthStart);

  // --- profile & account plumbing (what the signup trigger creates) ------------
  db.insertRow(
    'profiles',
    {
      id: userId,
      display_name: 'Carol',
      currency: 'USD',
      timezone: 'America/New_York',
      created_at: stamp(120),
      onboarding_completed_at: stamp(119),
    },
    ctx
  );
  db.insertRow(
    'user_settings',
    { user_id: userId, theme_preference: 'system', created_at: stamp(120) },
    ctx
  );
  db.insertRow('notification_preferences', { user_id: userId, created_at: stamp(120) }, ctx);
  // Free plan, never trialed — so upgrade gates and the "Start free trial" pitch render.
  db.insertRow(
    'entitlements',
    {
      user_id: userId,
      plan_tier: 'free',
      status: 'active',
      trial_ends_at: null,
      created_at: stamp(120),
    },
    ctx
  );

  // --- accounts -----------------------------------------------------------------
  const checking = own('accounts', {
    label: 'Checking',
    type: 'checking',
    balance_cents: cents(9860),
    created_at: stamp(120),
  });
  const savingsAccount = own('accounts', {
    label: 'Savings',
    type: 'savings',
    balance_cents: cents(3200),
    created_at: stamp(120),
  });

  // --- categories (design: Budget > Monthly budget) -----------------------------
  const categorySpecs: [keyof SeedIds['categories'], string, string, string, number][] = [
    ['housing', 'Housing', 'bill', '#0E6BA8', 1800],
    ['food', 'Food', 'groceries', '#2E9E5B', 600],
    ['transportation', 'Transportation', 'other', '#1B7FBF', 300],
    ['utilities', 'Utilities', 'bill', '#0FA3B1', 215],
    ['shopping', 'Shopping', 'other', '#8B6FD6', 160],
    ['entertainment', 'Entertainment', 'other', '#E0A800', 90],
    ['health', 'Health', 'other', '#D9534F', 100],
  ];
  const categories = {} as SeedIds['categories'];
  for (const [key, name, type, color] of categorySpecs) {
    categories[key] = own('categories', { name, type, color, created_at: stamp(119) }).id as string;
  }

  // Budget lines for last month and this month (the design's planned amounts).
  for (const monthOffset of [-1, 0]) {
    const period = own('budget_periods', {
      period_start: formatDate(monthStart(now, monthOffset)),
      period_end: formatDate(monthEnd(now, monthOffset)),
      created_at: stamp(monthOffset === 0 ? 20 : 45),
    });
    for (const [key, , , , planned] of categorySpecs) {
      own('budget_lines', {
        budget_period_id: period.id,
        category_id: categories[key],
        planned_cents: cents(planned),
        created_at: stamp(monthOffset === 0 ? 20 : 45),
      });
    }
  }

  // --- pay schedules & paychecks (design: Budget > Paycheck budget) -------------
  const nextMonthFirst = formatDate(monthStart(now, 1));
  const incomeSpecs = [
    {
      key: 'jamie',
      label: 'Jamie · Retail Job',
      amount: 1250,
      frequency: 'biweekly',
      next: dateAt(now, 6),
      step: 14,
    },
    {
      key: 'sam',
      label: 'Sam · Freelance Design',
      amount: 900,
      frequency: 'monthly',
      next: nextMonthFirst,
      step: 0,
    },
    {
      key: 'clifton',
      label: 'Clifton Lyons · Penske',
      amount: 2500,
      frequency: 'weekly',
      next: dateAt(now, 5),
      step: 7,
    },
    {
      key: 'carol',
      label: 'carol Lyons · Northside Hospital.',
      amount: 3000,
      frequency: 'biweekly',
      next: dateAt(now, 5),
      step: 14,
    },
  ] as const;
  const incomeSources = {} as SeedIds['incomeSources'];
  for (const spec of incomeSpecs) {
    const source = own('income_sources', {
      label: spec.label,
      amount_cents: cents(spec.amount),
      frequency: spec.frequency,
      next_pay_date: spec.next,
      created_at: stamp(119),
    });
    incomeSources[spec.key] = source.id as string;
  }
  // Recorded paychecks: everything that already landed in the last ~10 weeks.
  const paydayHistory: {
    sourceKey: keyof SeedIds['incomeSources'];
    date: string;
    amount: number;
  }[] = [];
  for (const spec of incomeSpecs) {
    if (spec.step === 0) {
      for (const back of [0, 1, 2]) {
        paydayHistory.push({
          sourceKey: spec.key,
          date: formatDate(monthStart(now, -back)),
          amount: spec.amount,
        });
      }
    } else {
      const next = new Date(`${spec.next}T00:00:00`);
      for (let k = 1; k <= 10; k++) {
        const date = addDays(next, -spec.step * k);
        if (formatDate(date) < dateAt(now, -70)) break;
        paydayHistory.push({ sourceKey: spec.key, date: formatDate(date), amount: spec.amount });
      }
    }
  }
  paydayHistory.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.sourceKey < b.sourceKey ? -1 : 1
  );
  // One recent paycheck has been "assigned" — earns the Paycheck Planner badge.
  const newestClifton = [...paydayHistory].reverse().find((p) => p.sourceKey === 'clifton');
  for (const p of paydayHistory) {
    own('paychecks', {
      income_source_id: incomeSources[p.sourceKey],
      amount_cents: cents(p.amount),
      pay_date: p.date,
      is_assigned: p === newestClifton,
      created_at: timestampAt(new Date(`${p.date}T00:00:00`), 0, 8),
    });
  }

  // --- bills (design: Bills tab) ------------------------------------------------
  const billSpecs = [
    {
      key: 'rent',
      label: 'Rent',
      amount: 1450,
      due: firstOfMonth,
      category: 'housing',
      remind: true,
      autopay: false,
    },
    {
      key: 'electric',
      label: 'Electric',
      amount: 145,
      due: dateAt(now, 3),
      category: 'utilities',
      remind: true,
      autopay: false,
    },
    {
      key: 'internet',
      label: 'Internet',
      amount: 70,
      due: dateAt(now, 5),
      category: 'utilities',
      remind: false,
      autopay: false,
    },
    {
      key: 'carInsurance',
      label: 'Car Insurance',
      amount: 120,
      due: dateAt(now, 8),
      category: 'transportation',
      remind: true,
      autopay: false,
    },
    {
      key: 'phone',
      label: 'Phone',
      amount: 85,
      due: dateAt(now, -6),
      category: 'utilities',
      remind: false,
      autopay: false,
    },
    {
      key: 'streaming',
      label: 'Streaming Bundle',
      amount: 24,
      due: dateAt(now, 11),
      category: 'entertainment',
      remind: false,
      autopay: true,
    },
  ] as const;
  const bills = {} as SeedIds['bills'];
  for (const spec of billSpecs) {
    const bill = own('bills', {
      category_id: categories[spec.category],
      label: spec.label,
      amount_cents: cents(spec.amount),
      due_date: spec.due,
      recurrence: 'monthly',
      autopay: spec.autopay,
      reminder_days_before: 3,
      reminder_enabled: spec.remind,
      created_at: stamp(110),
    });
    bills[spec.key] = bill.id as string;
  }
  // Rent paid in full; Internet half paid (partial); Streaming paid ahead by autopay.
  // Bill status is derived from the *sum* of a bill's payments vs its amount, so
  // each bill gets at most the one payment its design state needs.
  own('bill_payments', {
    bill_id: bills.rent,
    amount_cents: cents(1450),
    paid_on: firstOfMonth,
    created_at: stamp(0),
  });
  own('bill_payments', {
    bill_id: bills.internet,
    amount_cents: cents(35),
    paid_on: dateAt(now, -3),
    created_at: stamp(3),
  });
  own('bill_payments', {
    bill_id: bills.streaming,
    amount_cents: cents(24),
    paid_on: dateAt(now, -35),
    created_at: stamp(35),
  });

  // --- credit cards (design: Credit Cards tab; no limits/APRs entered) ---------
  const cardSpecs = [
    {
      label: 'Civic Legacy Credit Card',
      balance: 148141,
      min: 25,
      planned: 50,
      issuer: 'Bank of America',
      last4: '4821',
      network: 'Visa',
      style: 'navySky',
    },
    {
      label: 'Civic Classic Credit Card',
      balance: 79285,
      min: 25,
      planned: 50,
      issuer: 'Bank of America',
      last4: '2210',
      network: 'Visa',
      style: 'electricityEnergy',
    },
    {
      label: 'Chase',
      balance: 1922100,
      min: 224,
      planned: null,
      issuer: 'Chase',
      last4: null,
      network: null,
      style: 'skyNavy',
    },
    {
      label: 'AA Citi',
      balance: 624438,
      min: 281.25,
      planned: null,
      issuer: 'Citi',
      last4: null,
      network: null,
      style: 'panel',
    },
    {
      label: 'LGE Credit Card',
      balance: 294200,
      min: 40,
      planned: 75,
      issuer: null,
      last4: null,
      network: null,
      style: null,
    },
    {
      label: 'Discover — Husband',
      balance: 173000,
      min: 35,
      planned: null,
      issuer: 'Discover',
      last4: null,
      network: null,
      style: 'sunEnergy',
    },
    {
      label: "Sam's Club",
      balance: 81900,
      min: 29,
      planned: 50,
      issuer: "Sam's Club",
      last4: null,
      network: null,
      style: null,
    },
    {
      label: 'QVC',
      balance: 20900,
      min: 41,
      planned: null,
      issuer: null,
      last4: null,
      network: null,
      style: null,
    },
    {
      label: 'Belk',
      balance: 24300,
      min: 29,
      planned: 50,
      issuer: null,
      last4: null,
      network: null,
      style: null,
    },
    {
      label: 'Apple Credit — Carol',
      balance: 32500,
      min: 25,
      planned: 100,
      issuer: 'Apple',
      last4: null,
      network: null,
      style: 'sky',
    },
    {
      label: 'Apple Credit — Husband',
      balance: 18900,
      min: 25,
      planned: 50,
      issuer: 'Apple',
      last4: null,
      network: null,
      style: 'sky',
    },
  ];
  const cards: string[] = [];
  for (const spec of cardSpecs) {
    const card = own('debts', {
      label: spec.label,
      type: 'creditCard',
      balance_cents: spec.balance,
      apr_basis_points: 0,
      minimum_payment_cents: cents(spec.min),
      planned_payment_cents: spec.planned === null ? null : cents(spec.planned),
      issuer: spec.issuer,
      last4: spec.last4,
      network: spec.network,
      card_style: spec.style,
      created_at: stamp(100),
    });
    cards.push(card.id as string);
  }

  // --- loans & mortgages (design: Loans & Mortgages tab) ------------------------
  // Primary mortgage: $340,000 originally, $2,500 paid down (the design's "1% paid down").
  const primaryMortgage = own('debts', {
    label: 'Primary Mortgage',
    type: 'mortgage',
    balance_cents: cents(337500),
    original_balance_cents: cents(340000),
    minimum_payment_cents: cents(2368),
    created_at: stamp(100),
  });
  const secondMortgage = own('debts', {
    label: 'Second Mortgage',
    type: 'mortgage',
    balance_cents: 0,
    minimum_payment_cents: cents(975),
    created_at: stamp(100),
  });
  const heloc = own('debts', {
    label: 'HELOC',
    type: 'heloc',
    balance_cents: cents(64000),
    original_balance_cents: cents(64000),
    apr_basis_points: 750,
    minimum_payment_cents: 0,
    created_at: stamp(100),
  });
  const discover = own('debts', {
    label: 'Discover Personal Loan',
    type: 'personalLoan',
    balance_cents: cents(2420),
    original_balance_cents: cents(2420),
    minimum_payment_cents: cents(169),
    lender: 'Discover',
    created_at: stamp(100),
  });
  const affirm = own('debts', {
    label: 'Affirm',
    type: 'personalLoan',
    balance_cents: cents(680),
    original_balance_cents: cents(680),
    minimum_payment_cents: cents(95),
    lender: 'Affirm',
    created_at: stamp(100),
  });
  const otherLoan = own('debts', {
    label: 'Other Loan',
    type: 'other',
    balance_cents: 0,
    minimum_payment_cents: cents(93),
    created_at: stamp(100),
  });
  own('debt_payments', {
    debt_id: primaryMortgage.id,
    amount_cents: cents(2500),
    paid_on: dateAt(now, -40),
    created_at: stamp(40),
  });
  // Design: Payoff Plan — Snowball with $25 extra a month.
  own('payoff_plans', {
    strategy: 'snowball',
    extra_monthly_cents: cents(25),
    created_at: stamp(30),
  });

  // --- savings (design: Savings & Goals) ----------------------------------------
  const challenge = own('savings_goals', {
    label: '52-Week Money Challenge',
    target_cents: cents(1378),
    saved_cents: cents(15),
    is_challenge: true,
    category: 'General Savings',
    frequency: 'weekly',
    start_date: dateAt(now, -64),
    color: '#01ACD3',
    created_at: stamp(64),
  });
  const emergency = own('savings_goals', {
    label: 'Emergency Fund',
    target_cents: cents(6000),
    saved_cents: cents(3200),
    // Design: "Start Jun 1 · Target Jun 1, 2027", suggested $311 a month.
    target_date: formatDate(monthStart(now, 9)),
    category: 'Emergency Fund',
    frequency: 'monthly',
    start_date: dateAt(now, -111),
    color: '#01ACD3',
    created_at: stamp(115),
  });
  const vacation = own('savings_goals', {
    label: 'Family Vacation',
    target_cents: cents(2500),
    saved_cents: cents(900),
    target_date: formatDate(monthStart(now, 3)),
    category: 'Vacation',
    frequency: 'monthly',
    start_date: dateAt(now, -70),
    color: '#4A96EA',
    created_at: stamp(70),
  });
  const laptop = own('savings_goals', {
    label: 'New Laptop',
    target_cents: cents(1200),
    saved_cents: cents(1200),
    target_date: dateAt(now, -30),
    category: 'Major Purchase',
    frequency: 'monthly',
    start_date: dateAt(now, -100),
    color: '#001228',
    created_at: stamp(100),
  });
  own('savings_challenges', {
    goal_id: challenge.id,
    challenge_type: 'classic_ascending',
    cadence: 'weekly',
    total_weeks: 52,
    multiplier: 1,
    start_date: dateAt(now, -64),
    created_at: stamp(64),
  });
  // Deposits: every goal's saved_cents equals the sum of its deposits. All are >= 35 days
  // back so "monthly savings" starts at $0 like the design (a month is at most 31 days).
  const deposit = (
    goal: Row,
    dollars: number,
    daysAgo: number,
    note: string | null,
    challengeWeek?: number
  ) =>
    own('goal_activity', {
      goal_id: goal.id,
      amount_cents: cents(dollars),
      kind: 'deposit',
      note,
      occurred_on: dateAt(now, -daysAgo),
      created_at: timestampAt(now, -daysAgo, 12),
      ...(challengeWeek ? { challenge_week: challengeWeek } : {}),
    });
  // 52-week challenge: weeks 1-5 ($1..$5), one a week — a 5-week streak, "5/52 weeks".
  [63, 56, 49, 42, 35].forEach((daysAgo, i) =>
    deposit(challenge, i + 1, daysAgo, `Week ${i + 1}`, i + 1)
  );
  deposit(emergency, 2000, 111, 'Jamie · Retail Job');
  deposit(emergency, 1200, 77, 'Jamie · Weekend Gig');
  deposit(vacation, 500, 58, null);
  deposit(vacation, 400, 38, null);
  deposit(laptop, 700, 90, null);
  deposit(laptop, 500, 45, null);

  // --- day-to-day spending (feeds "Track every expense for 7 days" and the Budget actuals) ---
  const spending: [number, string, keyof SeedIds['categories'], number][] = [
    [0, 'Coffee Shop', 'food', 6.25],
    [1, 'Kroger', 'food', 84.32],
    [2, 'Shell', 'transportation', 41.1],
    [3, 'Chipotle', 'food', 13.85],
    [4, 'Target', 'shopping', 52.47],
    [5, 'AMC Theatres', 'entertainment', 28],
    [6, 'CVS Pharmacy', 'health', 18.64],
    [8, "Trader Joe's", 'food', 67.9],
    [9, 'Shell', 'transportation', 38.75],
    [11, 'Olive Garden', 'food', 46.2],
    [13, 'Amazon', 'shopping', 31.99],
    [15, 'Kroger', 'food', 91.14],
    [17, 'Walgreens', 'health', 22.3],
    [20, 'Spotify', 'entertainment', 11.99],
    [22, 'Shell', 'transportation', 44.6],
    [25, 'Kroger', 'food', 76.55],
    [28, 'Target', 'shopping', 63.2],
    [33, 'Chick-fil-A', 'food', 17.8],
    [36, 'Kroger', 'food', 88.02],
    [40, 'Dr. Patel copay', 'health', 30],
  ];
  for (const [daysAgo, label, category, amount] of spending) {
    own('transactions', {
      account_id: checking.id,
      category_id: categories[category],
      amount_cents: -cents(amount),
      occurred_on: dateAt(now, -daysAgo),
      label,
      created_at: timestampAt(now, -daysAgo, 18),
    });
  }

  // --- groceries & receipts -----------------------------------------------------
  const groceryList = own('grocery_lists', { label: 'Grocery List', created_at: stamp(30) });
  const groceryItems: [string, number | null, boolean][] = [
    ['Milk', 399, false],
    ['Eggs (dozen)', 349, false],
    ['Sourdough bread', 599, false],
    ['Bananas', 199, true],
    ['Chicken thighs', 1099, false],
    ['Spinach', 349, false],
    ['Rice (5 lb)', 749, true],
    ['Coffee beans', 1299, false],
    ['Greek yogurt', 549, false],
    ['Dish soap', 399, false],
  ];
  for (const [label, price, checked] of groceryItems) {
    own('grocery_items', {
      grocery_list_id: groceryList.id,
      label,
      estimated_price_cents: price,
      is_checked: checked,
      created_at: stamp(2),
    });
  }
  const receiptSpecs: {
    store: string;
    daysAgo: number;
    items: [string, string, number, number][];
  }[] = [
    {
      store: 'Kroger',
      daysAgo: 1,
      items: [
        ['Milk', 'Dairy', 399, 1],
        ['Bananas', 'Produce', 62, 3],
        ['Chicken breast', 'Meat', 1240, 1],
        ['Sourdough bread', 'Bakery', 599, 1],
        ['Frozen pizza', 'Frozen', 799, 2],
      ],
    },
    {
      store: "Trader Joe's",
      daysAgo: 8,
      items: [
        ['Spinach', 'Produce', 349, 1],
        ['Greek yogurt', 'Dairy', 549, 2],
        ['Almonds', 'Snacks', 899, 1],
        ['Sparkling water', 'Beverages', 599, 1],
      ],
    },
    {
      store: 'Target',
      daysAgo: 15,
      items: [
        ['Dish soap', 'Household', 399, 1],
        ['Paper towels', 'Household', 1299, 1],
        ['Coffee beans', 'Pantry', 1299, 1],
        ['Granola bars', 'Snacks', 449, 2],
      ],
    },
    {
      store: 'Aldi',
      daysAgo: 23,
      items: [
        ['Eggs (dozen)', 'Dairy', 349, 2],
        ['Rice (5 lb)', 'Pantry', 749, 1],
        ['Apples', 'Produce', 99, 6],
        ['Ground beef', 'Meat', 1099, 1],
      ],
    },
    {
      store: 'Kroger',
      daysAgo: 33,
      items: [
        ['Milk', 'Dairy', 389, 1],
        ['Pasta', 'Pantry', 199, 3],
        ['Tomato sauce', 'Pantry', 249, 2],
        ['Salmon fillet', 'Meat', 1499, 1],
      ],
    },
    {
      store: 'Costco',
      daysAgo: 41,
      items: [
        ['Paper towels', 'Household', 2199, 1],
        ['Chicken thighs', 'Meat', 1899, 1],
        ['Bagged salad', 'Produce', 649, 2],
      ],
    },
  ];
  for (const spec of receiptSpecs) {
    const subtotal = spec.items.reduce((sum, [, , price, qty]) => sum + price * qty, 0);
    const tax = Math.round(subtotal * 0.03);
    const receipt = own('receipts', {
      store_label: spec.store,
      purchased_on: dateAt(now, -spec.daysAgo),
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: subtotal + tax,
      ai_extraction_status: 'confirmed',
      created_at: timestampAt(now, -spec.daysAgo, 19),
    });
    for (const [label, category, price, quantity] of spec.items) {
      own('receipt_items', {
        receipt_id: receipt.id,
        label,
        category,
        price_cents: price,
        quantity,
        created_at: timestampAt(now, -spec.daysAgo, 19),
      });
    }
  }

  // --- shared mission catalog ---------------------------------------------------
  const missionSpecs: [string, string, string][] = [
    [
      'track-expenses',
      'Track every expense for 7 days',
      'Log at least one transaction on each of the last 7 days.',
    ],
    [
      'monthly-deposits',
      'Make 4 savings deposits this month',
      'Small, steady deposits build the habit.',
    ],
    ['emergency-cushion', 'Build your emergency cushion', 'Follows your emergency fund goal.'],
    [
      'review-subscriptions',
      'Review subscriptions',
      'Look over what you pay for every month and cancel anything unused.',
    ],
  ];
  for (const [slug, title, description] of missionSpecs) {
    ins('missions', { slug, title, description, created_at: stamp(120) });
  }

  return {
    userId,
    accounts: { checking: checking.id as string, savings: savingsAccount.id as string },
    categories,
    incomeSources,
    bills,
    cards,
    loans: {
      primaryMortgage: primaryMortgage.id as string,
      secondMortgage: secondMortgage.id as string,
      heloc: heloc.id as string,
      discover: discover.id as string,
      affirm: affirm.id as string,
      other: otherLoan.id as string,
    },
    goals: {
      challenge: challenge.id as string,
      emergency: emergency.id as string,
      vacation: vacation.id as string,
      laptop: laptop.id as string,
    },
    groceryList: groceryList.id as string,
  };
}
