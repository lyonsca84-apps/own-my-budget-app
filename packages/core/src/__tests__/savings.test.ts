import {
  calculateSavingsProgress,
  calculateProjectedCompletionDate,
  generateChallengeAmounts,
} from '../savings';

describe('calculateSavingsProgress', () => {
  it('computes percent and remaining toward a target', () => {
    expect(calculateSavingsProgress(25_00, 100_00)).toEqual({
      percent: 25,
      remainingCents: 75_00,
      isComplete: false,
    });
  });

  it('caps percent at 100 and flags complete when saved meets or exceeds target', () => {
    expect(calculateSavingsProgress(150_00, 100_00)).toEqual({
      percent: 100,
      remainingCents: 0,
      isComplete: true,
    });
  });

  it('treats a zero or negative target as already complete rather than dividing by zero', () => {
    expect(calculateSavingsProgress(0, 0)).toEqual({
      percent: 0,
      remainingCents: 0,
      isComplete: true,
    });
  });
});

describe('calculateProjectedCompletionDate', () => {
  // Constructed via (y, m, d), not a bare date string — the latter parses as
  // UTC midnight and can shift a day off in non-UTC timezones.
  const jan1 = new Date(2026, 0, 1);

  it('projects a date based on a steady monthly contribution', () => {
    // $300 remaining at $100/mo -> 3 months out.
    const result = calculateProjectedCompletionDate(0, 300_00, 100_00, jan1);
    expect(result).toBe('2026-04-01');
  });

  it('rounds partial months up rather than down', () => {
    // $250 remaining at $100/mo -> 3 months needed (2.5 rounds up), not 2.
    const result = calculateProjectedCompletionDate(0, 250_00, 100_00, jan1);
    expect(result).toBe('2026-04-01');
  });

  it('returns null when the goal is already met', () => {
    expect(calculateProjectedCompletionDate(100_00, 100_00, 50_00)).toBeNull();
  });

  it('returns null when there is no contribution to project from', () => {
    expect(calculateProjectedCompletionDate(0, 100_00, 0)).toBeNull();
  });
});

describe('generateChallengeAmounts', () => {
  it('generates the classic $1-per-week-number ascending schedule by default', () => {
    expect(generateChallengeAmounts('classic_ascending', 4)).toEqual([100, 200, 300, 400]);
  });

  it('scales the ascending schedule to hit an explicit target', () => {
    const amounts = generateChallengeAmounts('classic_ascending', 4, { targetCents: 2_000 });
    expect(amounts).toEqual([200, 400, 600, 800]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(2_000);
  });

  it('reverses the ascending schedule for the "reverse" type', () => {
    expect(generateChallengeAmounts('reverse', 4)).toEqual([400, 300, 200, 100]);
  });

  it('spreads a flat schedule evenly, putting any rounding remainder in the last week', () => {
    const amounts = generateChallengeAmounts('flat', 3, { targetCents: 1_000 });
    expect(amounts).toEqual([333, 333, 334]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(1_000);
  });

  it('echoes back a valid custom schedule', () => {
    expect(generateChallengeAmounts('custom', 3, { customAmountsCents: [100, 200, 300] })).toEqual([
      100, 200, 300,
    ]);
  });

  it('rejects a custom schedule with the wrong number of weeks', () => {
    expect(() =>
      generateChallengeAmounts('custom', 4, { customAmountsCents: [100, 200, 300] })
    ).toThrow(/exactly 4/);
  });
});
