/**
 * Navigates the browser tab to an external URL (a Stripe Checkout or
 * Billing Portal session). Kept as a plain function outside any component —
 * assigning `window.location.href` directly inside a component's event
 * handler trips the React Compiler's `react-hooks/immutability` rule,
 * which treats it as mutating something defined outside the component.
 */
export function redirectTo(url: string): void {
  window.location.href = url;
}
