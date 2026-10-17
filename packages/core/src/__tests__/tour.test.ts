import { calculateCashFlow, projectMonthIncomeCents } from '../dashboard';
import { buildOnboardingSavePlan, emptyIncomeDraft } from '../onboarding';
import {
  TOUR_SECTIONS,
  dismissTour,
  goToSection,
  initialTourState,
  nextSection,
  parseTourState,
  pauseTour,
  previousSection,
  recordSectionResult,
  resumeTour,
  startTour,
  tourProgressLabel,
  tourStorageKey,
  unfinishedSections,
} from '../tour';

describe('tour sections', () => {
  it('visits every real tab in a sensible order', () => {
    expect(TOUR_SECTIONS.map((s) => s.id)).toEqual([
      'dashboard',
      'income',
      'budget',
      'bills',
      'cards',
      'loans',
      'savings',
      'grocery',
      'reports',
      'missions',
    ]);
    expect(new Set(TOUR_SECTIONS.map((s) => s.navTarget))).toEqual(
      new Set(['index', 'plan', 'bills', 'money', 'grocery', 'reports'])
    );
  });

  it('gives every section an explanation and a Key & Clue tip', () => {
    for (const section of TOUR_SECTIONS) {
      expect(section.explanation.length).toBeGreaterThan(40);
      expect(section.keyClue.term).toBeTruthy();
      expect(section.keyClue.text).toBeTruthy();
    }
  });

  it('interviews only through existing forms', () => {
    const forms = TOUR_SECTIONS.flatMap((s) => (s.interview ? [s.interview.formRoute] : []));
    expect(forms).toEqual([
      '/add-income',
      '/add-category',
      '/add-bill',
      '/add-debt',
      '/add-debt',
      '/add-savings-goal',
    ]);
  });

  it('keeps income and payment language distinct', () => {
    const income = TOUR_SECTIONS.find((s) => s.id === 'income')!;
    expect(income.explanation).toMatch(/money coming in/i);
    expect(income.keyClue.text).toMatch(/payment is money you send out/i);
    const cards = TOUR_SECTIONS.find((s) => s.id === 'cards')!;
    expect(cards.keyClue.text).toMatch(/balance is what you owe/i);
  });
});

describe('tour progress', () => {
  it('starts, moves forward and back, and completes after the last section', () => {
    let state = startTour(initialTourState());
    expect(state.status).toBe('active');
    expect(tourProgressLabel(state.current)).toBe('Section 1 of 10');
    state = nextSection(nextSection(state));
    expect(tourProgressLabel(state.current)).toBe('Section 3 of 10');
    state = previousSection(state);
    expect(state.current).toBe(1);
    state = previousSection(previousSection(state));
    expect(state.current).toBe(0);
    state = goToSection(state, TOUR_SECTIONS.length - 1);
    state = nextSection(state);
    expect(state.status).toBe('completed');
  });

  it('pauses and resumes at the same section', () => {
    const active = goToSection(startTour(initialTourState()), 4);
    const paused = pauseTour(active);
    expect(paused.status).toBe('paused');
    expect(resumeTour(paused)).toEqual({ ...active, status: 'active' });
    // Pausing something that isn't active changes nothing.
    expect(pauseTour(dismissTour(active)).status).toBe('dismissed');
  });

  it('replays from the start with fresh tour progress', () => {
    let state = recordSectionResult(startTour(initialTourState()), 'bills', 'added');
    state = { ...nextSection(state), status: 'completed' };
    const replay = startTour(state, { replay: true });
    expect(replay).toEqual({ version: 1, status: 'active', current: 0, results: {} });
  });

  it('never downgrades a section where something was added', () => {
    let state = recordSectionResult(initialTourState(), 'bills', 'added');
    state = recordSectionResult(state, 'bills', 'kept');
    expect(state.results.bills).toBe('added');
    state = recordSectionResult(state, 'bills', 'skipped');
    expect(state.results.bills).toBe('skipped');
  });

  it('lists skipped and later sections for finishing setup', () => {
    let state = recordSectionResult(initialTourState(), 'bills', 'later');
    state = recordSectionResult(state, 'cards', 'skipped');
    state = recordSectionResult(state, 'income', 'added');
    expect(unfinishedSections(state).map((s) => s.id)).toEqual(['bills', 'cards']);
  });
});

describe('tour storage', () => {
  it('round-trips and rejects malformed or unknown values', () => {
    const state = recordSectionResult(
      goToSection(startTour(initialTourState()), 3),
      'income',
      'kept'
    );
    expect(parseTourState(JSON.stringify(state))).toEqual(state);
    expect(parseTourState(null)).toBeNull();
    expect(parseTourState('not json')).toBeNull();
    expect(parseTourState(JSON.stringify({ ...state, version: 2 }))).toBeNull();
    expect(parseTourState(JSON.stringify({ ...state, status: 'weird' }))).toBeNull();
    const cleaned = parseTourState(
      JSON.stringify({
        ...state,
        current: 99,
        results: { income: 'added', nope: 'added', bills: 'x' },
      })
    );
    expect(cleaned).toEqual({ ...state, current: 9, results: { income: 'added' } });
    expect(tourStorageKey('u1')).toBe('own-my-budget:tour:u1');
  });
});

describe('income vs. payment separation (the $7,000 paycheck)', () => {
  // October 2026, the month Carol tested in.
  const YEAR = 2026;
  const OCTOBER = 9;

  it('stores a $7,000 monthly paycheck as income, not a payment', () => {
    const plan = buildOnboardingSavePlan({
      displayName: '',
      existingDisplayName: '',
      incomes: [
        {
          ...emptyIncomeDraft(),
          frequency: 'monthly',
          amountText: '7,000',
          nextPayDate: '2026-10-30',
        },
      ],
    });
    expect(plan.incomeRows).toEqual([
      {
        label: 'Take-home pay',
        amount_cents: 700_000,
        frequency: 'monthly',
        next_pay_date: '2026-10-30',
        is_variable: false,
      },
    ]);
    const income = projectMonthIncomeCents(
      plan.incomeRows.map((r) => ({
        frequency: r.frequency,
        nextPayDate: r.next_pay_date,
        amountCents: r.amount_cents,
      })),
      YEAR,
      OCTOBER
    );
    expect(income).toBe(700_000);

    // Nothing recorded going out: the income is not subtracted from itself.
    const flow = calculateCashFlow({
      incomeCents: income,
      billsCents: 0,
      debtCents: 0,
      variableCents: 0,
      savingsCents: 0,
    });
    expect(flow.incomeCents).toBe(700_000);
    expect(flow.billsCents + flow.debtCents + flow.variableCents).toBe(0);
    expect(flow.availableCents).toBe(700_000);
  });

  it('counts $3,500 every two weeks as $7,000 of October income', () => {
    expect(
      projectMonthIncomeCents(
        [{ frequency: 'biweekly', nextPayDate: '2026-10-19', amountCents: 350_000 }],
        YEAR,
        OCTOBER
      )
    ).toBe(700_000);
  });

  it('a separate $500 payment reduces available money once and leaves income alone', () => {
    const flow = calculateCashFlow({
      incomeCents: 700_000,
      billsCents: 0,
      debtCents: 50_000,
      variableCents: 0,
      savingsCents: 0,
    });
    expect(flow.incomeCents).toBe(700_000);
    expect(flow.availableCents).toBe(650_000);
  });
});
