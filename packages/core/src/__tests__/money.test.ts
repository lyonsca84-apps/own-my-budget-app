import { formatCents } from '../money';

describe('formatCents', () => {
  it('formats whole dollars', () => {
    expect(formatCents(184_732)).toBe('$1,847.32');
  });

  it('formats a value under a dollar', () => {
    expect(formatCents(50)).toBe('$0.50');
  });

  it('formats negative amounts (e.g. a transaction outflow)', () => {
    expect(formatCents(-8_734)).toBe('-$87.34');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });
});
