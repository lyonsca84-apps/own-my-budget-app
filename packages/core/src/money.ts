/**
 * Money is always stored as integer cents (never floats) — see PLAN.md's data
 * rules. These are the only helpers that should ever format cents for display;
 * screens should never do their own division/toFixed on a money value.
 */

export function formatCents(cents: number, currency: 'USD' = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
