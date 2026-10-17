import { matchBillName } from '../billMatch';

const BILLS = [
  { id: 'bill-1', label: 'Georgia Power' },
  { id: 'bill-2', label: 'Comcast Internet' },
  { id: 'bill-3', label: 'Rent' },
];

describe('matchBillName — exact matches', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(matchBillName('georgia power', BILLS)).toEqual({ billId: 'bill-1', matchKind: 'exact' });
    expect(matchBillName('  Georgia Power  ', BILLS)).toEqual({
      billId: 'bill-1',
      matchKind: 'exact',
    });
  });

  it('ignores punctuation differences', () => {
    expect(matchBillName('Georgia Power!', BILLS)).toEqual({
      billId: 'bill-1',
      matchKind: 'exact',
    });
  });
});

describe('matchBillName — fuzzy matches', () => {
  it('matches via substring containment', () => {
    expect(matchBillName('Comcast', BILLS)).toEqual({ billId: 'bill-2', matchKind: 'fuzzy' });
  });

  it('matches a close misspelling via edit distance', () => {
    expect(matchBillName('Georiga Power', BILLS)).toEqual({ billId: 'bill-1', matchKind: 'fuzzy' });
  });
});

describe('matchBillName — no match', () => {
  it('returns none for an unrelated name', () => {
    expect(matchBillName('Netflix', BILLS)).toEqual({ billId: null, matchKind: 'none' });
  });

  it('returns none for an empty candidate', () => {
    expect(matchBillName('', BILLS)).toEqual({ billId: null, matchKind: 'none' });
  });

  it('returns none when the user has no bills on file', () => {
    expect(matchBillName('Georgia Power', [])).toEqual({ billId: null, matchKind: 'none' });
  });

  it('does not force a match for a very short, generic candidate against unrelated bills', () => {
    expect(matchBillName('gas', BILLS)).toEqual({ billId: null, matchKind: 'none' });
  });
});
