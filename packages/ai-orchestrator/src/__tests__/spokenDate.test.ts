import { parseSpokenDate } from '../spokenDate';

// Wednesday, October 7, 2026 — an arbitrary fixed reference point.
const REF = new Date(2026, 9, 7);

describe('parseSpokenDate — relative phrases', () => {
  it('today', () => {
    expect(parseSpokenDate('today', REF)).toEqual({
      isoDate: '2026-10-07',
      confidence: 'relative',
    });
  });
  it('yesterday', () => {
    expect(parseSpokenDate('yesterday', REF)).toEqual({
      isoDate: '2026-10-06',
      confidence: 'relative',
    });
  });
  it('tomorrow', () => {
    expect(parseSpokenDate('tomorrow', REF)).toEqual({
      isoDate: '2026-10-08',
      confidence: 'relative',
    });
  });
  it('N days ago', () => {
    expect(parseSpokenDate('3 days ago', REF)).toEqual({
      isoDate: '2026-10-04',
      confidence: 'relative',
    });
  });
  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(parseSpokenDate('  YESTERDAY  ', REF)).toEqual({
      isoDate: '2026-10-06',
      confidence: 'relative',
    });
  });
  it('crosses a month boundary correctly', () => {
    const lastDayOfMonth = new Date(2026, 9, 1); // Oct 1
    expect(parseSpokenDate('yesterday', lastDayOfMonth)).toEqual({
      isoDate: '2026-09-30',
      confidence: 'relative',
    });
  });
  it('"the 3rd" resolves within the reference month', () => {
    expect(parseSpokenDate('the 3rd', REF)).toEqual({
      isoDate: '2026-10-03',
      confidence: 'relative',
    });
  });
});

describe('parseSpokenDate — explicit dates', () => {
  it('ISO YYYY-MM-DD', () => {
    expect(parseSpokenDate('2026-10-03', REF)).toEqual({
      isoDate: '2026-10-03',
      confidence: 'exact',
    });
  });
  it('MM/DD assumes the reference year', () => {
    expect(parseSpokenDate('10/3', REF)).toEqual({ isoDate: '2026-10-03', confidence: 'exact' });
  });
  it('MM/DD/YYYY', () => {
    expect(parseSpokenDate('10/3/2025', REF)).toEqual({
      isoDate: '2025-10-03',
      confidence: 'exact',
    });
  });
  it('MM/DD/YY normalizes a 2-digit year', () => {
    expect(parseSpokenDate('10/3/25', REF)).toEqual({ isoDate: '2025-10-03', confidence: 'exact' });
  });
  it('full month name with ordinal suffix', () => {
    expect(parseSpokenDate('October 3rd', REF)).toEqual({
      isoDate: '2026-10-03',
      confidence: 'exact',
    });
  });
  it('abbreviated month name with explicit year', () => {
    expect(parseSpokenDate('oct 3, 2025', REF)).toEqual({
      isoDate: '2025-10-03',
      confidence: 'exact',
    });
  });
});

describe('parseSpokenDate — rejects unparseable or invalid input, never guesses', () => {
  it('empty string', () => {
    expect(parseSpokenDate('', REF)).toBeNull();
  });
  it('nonsense text', () => {
    expect(parseSpokenDate('sometime last week probably', REF)).toBeNull();
  });
  it('an out-of-range calendar date (Feb 30)', () => {
    expect(parseSpokenDate('2026-02-30', REF)).toBeNull();
  });
  it('an invalid month number', () => {
    expect(parseSpokenDate('13/1/2026', REF)).toBeNull();
  });
  it('an unrecognized month name', () => {
    expect(parseSpokenDate('Octember 3rd', REF)).toBeNull();
  });
});
