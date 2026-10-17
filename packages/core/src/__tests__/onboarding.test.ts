import { projectMonthIncomeCents } from '../dashboard';
import {
  buildOnboardingSavePlan,
  emptyIncomeDraft,
  explainMonthlyIncome,
  hasIncomeDraftErrors,
  parseOnboardingAmount,
  validateIncomeDraft,
  type OnboardingIncomeDraft,
} from '../onboarding';

const TODAY = new Date(2026, 9, 17); // Oct 17, 2026

function draft(overrides: Partial<OnboardingIncomeDraft>): OnboardingIncomeDraft {
  return { ...emptyIncomeDraft(), ...overrides };
}

describe('parseOnboardingAmount', () => {
  it('reads plain and formatted dollar amounts as cents', () => {
    expect(parseOnboardingAmount('850')).toBe(85000);
    expect(parseOnboardingAmount('$1,234.5')).toBe(123450);
    expect(parseOnboardingAmount(' 12.34 ')).toBe(1234);
    expect(parseOnboardingAmount('.5')).toBe(50);
  });

  it('keeps blank as unknown, never zero', () => {
    expect(parseOnboardingAmount('')).toBeNull();
    expect(parseOnboardingAmount('   ')).toBeNull();
  });

  it('rejects text, negatives, extra decimals and typo-sized amounts', () => {
    expect(parseOnboardingAmount('abc')).toBe('invalid');
    expect(parseOnboardingAmount('-20')).toBe('invalid');
    expect(parseOnboardingAmount('1.234')).toBe('invalid');
    expect(parseOnboardingAmount('1e5')).toBe('invalid');
    expect(parseOnboardingAmount('50000000')).toBe('invalid');
  });
});

describe('validateIncomeDraft', () => {
  it('asks for a frequency and an amount', () => {
    const errors = validateIncomeDraft(emptyIncomeDraft(), TODAY);
    expect(errors.frequency).toBeDefined();
    expect(errors.amount).toBeDefined();
    expect(hasIncomeDraftErrors(errors)).toBe(true);
  });

  it('rejects a zero paycheck', () => {
    const errors = validateIncomeDraft(draft({ frequency: 'monthly', amountText: '0' }), TODAY);
    expect(errors.amount).toBeDefined();
  });

  it('needs a next payday for weekly and biweekly pay only', () => {
    expect(
      validateIncomeDraft(draft({ frequency: 'biweekly', amountText: '900' }), TODAY).nextPayDate
    ).toBeDefined();
    expect(
      validateIncomeDraft(draft({ frequency: 'weekly', amountText: '450' }), TODAY).nextPayDate
    ).toBeDefined();
    expect(
      hasIncomeDraftErrors(
        validateIncomeDraft(draft({ frequency: 'monthly', amountText: '3000' }), TODAY)
      )
    ).toBe(false);
    expect(
      hasIncomeDraftErrors(
        validateIncomeDraft(draft({ frequency: 'twice_monthly', amountText: '1500' }), TODAY)
      )
    ).toBe(false);
  });

  it('never asks irregular earners for a payday', () => {
    const errors = validateIncomeDraft(
      draft({ frequency: 'irregular', amountText: '2200', nextPayDate: 'garbage' }),
      TODAY
    );
    expect(hasIncomeDraftErrors(errors)).toBe(false);
  });

  it('rejects impossible and far-off paydays', () => {
    const base = { frequency: 'biweekly' as const, amountText: '900' };
    expect(
      validateIncomeDraft(draft({ ...base, nextPayDate: '2026-02-31' }), TODAY).nextPayDate
    ).toBeDefined();
    expect(
      validateIncomeDraft(draft({ ...base, nextPayDate: '2026-08-01' }), TODAY).nextPayDate
    ).toBeDefined();
    expect(
      validateIncomeDraft(draft({ ...base, nextPayDate: '2028-01-01' }), TODAY).nextPayDate
    ).toBeDefined();
    expect(
      hasIncomeDraftErrors(
        validateIncomeDraft(draft({ ...base, nextPayDate: '2026-10-23' }), TODAY)
      )
    ).toBe(false);
  });
});

describe('explainMonthlyIncome', () => {
  it('counts biweekly paydays with the same rule the Dashboard uses', () => {
    const d = draft({ frequency: 'biweekly', amountText: '900', nextPayDate: '2026-10-02' });
    const result = explainMonthlyIncome(d, 2026, 9);
    // Oct 2026: paydays on the 2nd, 16th and 30th.
    expect(result).toMatchObject({ kind: 'calculated', paydays: 3, monthlyCents: 270000 });
    expect(result.text).toContain('3 paydays in October × $900.00 = $2,700.00');
    expect(result.text).toContain('extra payday');

    const dashboardCents = projectMonthIncomeCents(
      [{ frequency: 'biweekly', nextPayDate: '2026-10-02', amountCents: 90000 }],
      2026,
      9
    );
    expect(result.kind === 'calculated' && result.monthlyCents).toBe(dashboardCents);
  });

  it('shows monthly and twice-monthly math without needing a date', () => {
    expect(
      explainMonthlyIncome(draft({ frequency: 'monthly', amountText: '3000' }), 2026, 9)
    ).toMatchObject({ kind: 'calculated', paydays: 1, monthlyCents: 300000 });
    expect(
      explainMonthlyIncome(draft({ frequency: 'twice_monthly', amountText: '1500' }), 2026, 9)
    ).toMatchObject({ kind: 'calculated', paydays: 2, monthlyCents: 300000 });
  });

  it('uses an irregular estimate exactly as typed', () => {
    expect(
      explainMonthlyIncome(draft({ frequency: 'irregular', amountText: '2200' }), 2026, 9)
    ).toMatchObject({ kind: 'estimate', monthlyCents: 220000 });
  });

  it('refuses to guess when the payday or amount is missing', () => {
    expect(
      explainMonthlyIncome(draft({ frequency: 'weekly', amountText: '450' }), 2026, 9).kind
    ).toBe('unknown');
    expect(explainMonthlyIncome(draft({ frequency: 'monthly' }), 2026, 9).kind).toBe('unknown');
  });
});

describe('buildOnboardingSavePlan', () => {
  it('saves nothing when everything was skipped', () => {
    expect(
      buildOnboardingSavePlan({ displayName: '  ', existingDisplayName: 'there', incomes: [] })
    ).toEqual({ displayName: null, incomeRows: [] });
  });

  it('does not rewrite an unchanged name', () => {
    expect(
      buildOnboardingSavePlan({ displayName: 'Jamie', existingDisplayName: 'Jamie', incomes: [] })
        .displayName
    ).toBeNull();
    expect(
      buildOnboardingSavePlan({ displayName: ' Sam ', existingDisplayName: 'there', incomes: [] })
        .displayName
    ).toBe('Sam');
  });

  it('stores fixed pay per paycheck and irregular pay as a flagged monthly estimate', () => {
    const plan = buildOnboardingSavePlan({
      displayName: '',
      existingDisplayName: 'there',
      incomes: [
        draft({ frequency: 'biweekly', amountText: '900', nextPayDate: '2026-10-23' }),
        draft({ frequency: 'monthly', amountText: '400' }),
        draft({ label: 'Rideshare', frequency: 'irregular', amountText: '650' }),
      ],
    });
    expect(plan.incomeRows).toEqual([
      {
        label: 'Take-home pay',
        amount_cents: 90000,
        frequency: 'biweekly',
        next_pay_date: '2026-10-23',
        is_variable: false,
      },
      {
        label: 'Take-home pay 2',
        amount_cents: 40000,
        frequency: 'monthly',
        next_pay_date: null,
        is_variable: false,
      },
      {
        label: 'Rideshare',
        amount_cents: 65000,
        frequency: 'monthly',
        next_pay_date: null,
        is_variable: true,
      },
    ]);
  });

  it('drops incomplete income rather than saving a zero', () => {
    const plan = buildOnboardingSavePlan({
      displayName: '',
      existingDisplayName: 'there',
      incomes: [draft({ frequency: 'monthly', amountText: '' }), draft({ amountText: '500' })],
    });
    expect(plan.incomeRows).toEqual([]);
  });
});
