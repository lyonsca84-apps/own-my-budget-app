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

/** Like {@link formatCents} but drops ".00" on whole-dollar amounts ("$1,250", "$1,250.50") — for tight list rows. */
export function formatCentsCompact(cents: number, currency: 'USD' = 'USD'): string {
  const isWhole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
