/**
 * Budget Buddy's guided tour — the pure rules behind it: which real sections
 * of the app it visits (in order), what Buddy says in each, and how progress
 * moves forward, pauses, resumes and replays.
 *
 * Safety rules carried through:
 * - The tour never writes budget data itself. "Add this now" opens the app's
 *   existing form for that section, so validation and saving are unchanged.
 * - Replaying the tour only resets tour progress, never the user's data.
 * - Copy is educational. Budget Buddy explains terms; it doesn't infer
 *   figures or give individualized financial advice.
 */

export type TourSectionId =
  | 'dashboard'
  | 'income'
  | 'budget'
  | 'bills'
  | 'cards'
  | 'loans'
  | 'savings'
  | 'grocery'
  | 'reports'
  | 'missions';

/** What the app counts to show "you already have…" and to confirm a save. */
export type TourCountKey = 'incomeSources' | 'categories' | 'bills' | 'cards' | 'loans' | 'goals';

export interface TourInterview {
  /** One focused question. */
  question: string;
  /** Label for the button that opens the existing form. */
  addLabel: string;
  /** Existing form route and its params. */
  formRoute: string;
  formParams?: Record<string, string>;
  countKey: TourCountKey;
  /** Singular/plural noun for confirmations ("bill" / "bills"). */
  noun: [string, string];
}

export interface TourSection {
  id: TourSectionId;
  title: string;
  /** Route the tour opens for this section. */
  route: string;
  /** Params for that route (e.g. which Budget or Bills view to show). */
  routeParams?: Record<string, string>;
  /**
   * Element to spotlight besides the tab itself. Defaults to the visible
   * screen (`tour-screen`); a narrower target is used where one card matters.
   */
  contentTarget?: string;
  /** Navigation item to spotlight (NAV_ITEMS name, or an extra sidebar link). */
  navTarget: 'index' | 'plan' | 'bills' | 'money' | 'grocery' | 'reports';
  /** Where to look on screen, in words (the visual spotlight is the nav item). */
  lookFor: string;
  explanation: string;
  keyClue: { term: string; text: string };
  interview?: TourInterview;
}

export const TOUR_SECTIONS: TourSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    route: '/',
    navTarget: 'index',
    lookFor: 'The Dashboard tab, and the four cards at the top.',
    explanation:
      'This is your home base. Total Income shows the take-home pay your pay schedules expect this month. Bills and Payments shows what’s due across bills, cards and loans. Money Available is income left after what you’ve recorded going out. It’s a planning number, not your bank balance.',
    keyClue: {
      term: 'Money Available',
      text: 'Income minus the bills, debt payments, spending and savings you’ve recorded. With only income added, it equals your income.',
    },
  },
  {
    id: 'income',
    title: 'Income and paychecks',
    route: '/plan',
    routeParams: { view: 'paycheck' },
    navTarget: 'plan',
    lookFor: 'The Budget tab, then “Paycheck budget” and “Pay schedules.”',
    explanation:
      'Income is money coming in. Your pay schedules live on the Budget tab under Paycheck budget. Enter the take-home pay from each paycheck and how often it arrives. The app counts the paydays in each month to get your monthly income.',
    keyClue: {
      term: 'Income vs. payments',
      text: 'A paycheck adds to your income. A payment is money you send out for a bill, card or loan. The app keeps them separate.',
    },
    interview: {
      question: 'Would you like to add a pay schedule now?',
      addLabel: 'Add income',
      formRoute: '/add-income',
      countKey: 'incomeSources',
      noun: ['pay schedule', 'pay schedules'],
    },
  },
  {
    id: 'budget',
    title: 'Budget',
    route: '/plan',
    routeParams: { view: 'monthly' },
    navTarget: 'plan',
    lookFor: 'The Budget tab, under “Monthly budget” and “Planned vs actual.”',
    explanation:
      'This is your spending plan. Each category has a planned amount, what you expect to spend, and an actual amount, what you’ve recorded. After adding a category, type its planned amount right in the Planned vs actual list.',
    keyClue: {
      term: 'Planned vs. actual',
      text: 'Planned is your target for the month. Actual is what you’ve recorded spending so far.',
    },
    interview: {
      question: 'Would you like to add a spending category, like Groceries or Rent?',
      addLabel: 'Add a category',
      formRoute: '/add-category',
      countKey: 'categories',
      noun: ['category', 'categories'],
    },
  },
  {
    id: 'bills',
    title: 'Monthly bills',
    route: '/bills',
    routeParams: { view: 'bills' },
    navTarget: 'bills',
    lookFor: 'The Bills & Debt tab, under “Bills.”',
    explanation:
      'Bills are recurring household costs like rent, utilities or your phone. Each bill has an amount, a due date and how often it repeats. Marking a bill paid records money going out.',
    keyClue: {
      term: 'Due date',
      text: 'When a bill is expected to be paid. A bill’s amount is what’s due, not money coming in.',
    },
    interview: {
      question: 'Would you like to add a bill now?',
      addLabel: 'Add a bill',
      formRoute: '/add-bill',
      countKey: 'bills',
      noun: ['bill', 'bills'],
    },
  },
  {
    id: 'cards',
    title: 'Credit cards',
    route: '/bills',
    routeParams: { view: 'cards' },
    navTarget: 'bills',
    lookFor: 'The Bills & Debt tab, under “Credit Cards.”',
    explanation:
      'A card has a balance (what you owe), a credit limit, an APR, a minimum due and a due day. Payments you record lower the balance. The balance, the amount due and your payments are separate numbers.',
    keyClue: {
      term: 'Balance vs. payment',
      text: 'A card balance is what you owe. A payment is what you send.',
    },
    interview: {
      question: 'Would you like to add a credit card? Only add what you want to track.',
      addLabel: 'Add a card',
      formRoute: '/add-debt',
      formParams: { kind: 'card' },
      countKey: 'cards',
      noun: ['card', 'cards'],
    },
  },
  {
    id: 'loans',
    title: 'Loans and mortgage',
    route: '/bills',
    routeParams: { view: 'loans' },
    navTarget: 'bills',
    lookFor: 'The Bills & Debt tab, under “Loans & Mortgages.”',
    explanation:
      'Loans and mortgages have a balance owed, an interest rate, a monthly payment and a due day. The balance is what’s left to pay. It isn’t a payment and isn’t subtracted from your income.',
    keyClue: {
      term: 'APR',
      text: 'The yearly interest rate charged on what you owe.',
    },
    interview: {
      question: 'Would you like to add a loan or mortgage?',
      addLabel: 'Add a loan',
      formRoute: '/add-debt',
      formParams: { kind: 'loan' },
      countKey: 'loans',
      noun: ['loan', 'loans'],
    },
  },
  {
    id: 'savings',
    title: 'Savings and goals',
    route: '/money',
    navTarget: 'money',
    lookFor: 'The Savings & Goals tab.',
    explanation:
      'Savings & Goals tracks money you set aside. A goal has a target and how much is saved so far, and can have a target date and a planned deposit. The 52-Week Money Challenge lives here too.',
    keyClue: {
      term: 'Target',
      text: 'The total you’re aiming to save. If you don’t know an amount yet, leave it blank.',
    },
    interview: {
      question: 'Would you like to start a savings goal?',
      addLabel: 'Add a savings goal',
      formRoute: '/add-savings-goal',
      countKey: 'goals',
      noun: ['savings goal', 'savings goals'],
    },
  },
  {
    id: 'grocery',
    title: 'Groceries and spending',
    route: '/grocery-list',
    navTarget: 'grocery',
    lookFor: 'Grocery in the sidebar, or More → Grocery on a phone.',
    explanation:
      'Grocery helps with food spending: keep a shopping list and scan receipts or your pantry. To plan a monthly grocery amount, add a Groceries category on the Budget tab and set its planned amount. A purchase you record is an expense, money going out.',
    keyClue: {
      term: 'Expense',
      text: 'Money spent. Planned grocery money isn’t spent until you record a purchase.',
    },
  },
  {
    id: 'reports',
    title: 'Reports',
    route: '/reports',
    navTarget: 'reports',
    lookFor: 'Reports in the sidebar, or More → Reports on a phone.',
    explanation:
      'Reports show trends over time: spending by category, income vs. expenses, and debt and savings progress. They fill in as you log paychecks and record payments and spending.',
    keyClue: {
      term: 'Logged paycheck',
      text: 'Reports count paychecks you log as received. Your pay schedule is what the Dashboard expects to come in.',
    },
  },
  {
    id: 'missions',
    title: 'Missions and Budget Buddy',
    route: '/',
    contentTarget: 'tour-missions',
    navTarget: 'index',
    lookFor: 'Budget missions on the Dashboard, and the Budget Buddy button.',
    explanation:
      'Budget missions are small, optional practice steps, like tracking every expense for a week. The Budget Buddy button opens the AI helper, which explains your budget and the app. Free accounts get a few helper actions to try.',
    keyClue: {
      term: 'Mission',
      text: 'A short, optional challenge to build a habit. Skipping one costs nothing.',
    },
  },
];

export type TourStatus = 'notStarted' | 'active' | 'paused' | 'completed' | 'dismissed';

/**
 * What happened in a section:
 * - added: the user saved something through the section's form
 * - kept: they already had data and chose to keep it
 * - later: "I'll add it later"
 * - skipped: "Skip this section"
 * - viewed: an explanation-only section was read
 */
export type TourSectionResult = 'added' | 'kept' | 'later' | 'skipped' | 'viewed';

export interface TourState {
  version: 1;
  status: TourStatus;
  /** Index into TOUR_SECTIONS. */
  current: number;
  results: Partial<Record<TourSectionId, TourSectionResult>>;
}

export function initialTourState(): TourState {
  return { version: 1, status: 'notStarted', current: 0, results: {} };
}

/** Starts (or replays) from the first section. Replays clear tour progress only, never budget data. */
export function startTour(
  state: TourState,
  options: { replay?: boolean; startAt?: number } = {}
): TourState {
  const results = options.replay ? {} : state.results;
  return { ...state, status: 'active', current: clampIndex(options.startAt ?? 0), results };
}

export function goToSection(state: TourState, index: number): TourState {
  return { ...state, status: 'active', current: clampIndex(index) };
}

/** Moves on; after the last section the tour is completed. */
export function nextSection(state: TourState): TourState {
  if (state.current >= TOUR_SECTIONS.length - 1) return { ...state, status: 'completed' };
  return { ...state, current: state.current + 1 };
}

export function previousSection(state: TourState): TourState {
  return { ...state, current: Math.max(0, state.current - 1) };
}

export function recordSectionResult(
  state: TourState,
  id: TourSectionId,
  result: TourSectionResult
): TourState {
  // "added" is never downgraded by a later "kept"/"viewed" on the same section.
  if (state.results[id] === 'added' && (result === 'kept' || result === 'viewed')) return state;
  return { ...state, results: { ...state.results, [id]: result } };
}

export function pauseTour(state: TourState): TourState {
  return state.status === 'active' ? { ...state, status: 'paused' } : state;
}

export function resumeTour(state: TourState): TourState {
  return state.status === 'paused' ? { ...state, status: 'active' } : state;
}

export function dismissTour(state: TourState): TourState {
  return { ...state, status: 'dismissed' };
}

/** "Section 3 of 10". */
export function tourProgressLabel(index: number): string {
  return `Section ${clampIndex(index) + 1} of ${TOUR_SECTIONS.length}`;
}

/** Sections answered with "later" or "skipped", for an easy path to finish setup. */
export function unfinishedSections(state: TourState): TourSection[] {
  return TOUR_SECTIONS.filter(
    (s) => s.interview && (state.results[s.id] === 'later' || state.results[s.id] === 'skipped')
  );
}

const STATUSES: TourStatus[] = ['notStarted', 'active', 'paused', 'completed', 'dismissed'];
const RESULTS: TourSectionResult[] = ['added', 'kept', 'later', 'skipped', 'viewed'];

/** Reads a stored state; anything malformed or from another version is ignored. */
export function parseTourState(raw: string | null): TourState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TourState>;
    if (value?.version !== 1 || !STATUSES.includes(value.status as TourStatus)) return null;
    if (typeof value.current !== 'number' || !Number.isInteger(value.current)) return null;
    const results: TourState['results'] = {};
    const ids = new Set(TOUR_SECTIONS.map((s) => s.id));
    for (const [id, result] of Object.entries(value.results ?? {})) {
      if (ids.has(id as TourSectionId) && RESULTS.includes(result as TourSectionResult)) {
        results[id as TourSectionId] = result as TourSectionResult;
      }
    }
    return {
      version: 1,
      status: value.status as TourStatus,
      current: clampIndex(value.current),
      results,
    };
  } catch {
    return null;
  }
}

/** Device storage key for one signed-in user's tour progress. */
export function tourStorageKey(userId: string): string {
  return `own-my-budget:tour:${userId}`;
}

function clampIndex(index: number): number {
  return Math.min(Math.max(0, Math.trunc(index)), TOUR_SECTIONS.length - 1);
}
