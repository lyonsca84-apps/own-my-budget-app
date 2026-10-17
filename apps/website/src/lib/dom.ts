/** Escapes text for safe interpolation into HTML strings. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function $(selector: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(selector);
}

export function $all(selector: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

/** Formats an ISO timestamp as "November 4, 2026" in the visitor's locale. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Wires an accordion: each `.faq-toggle` button controls the element named by aria-controls. */
export function wireAccordions(root: ParentNode = document): void {
  for (const button of $all('.faq-toggle', root)) {
    if (button.dataset.wired) continue;
    button.dataset.wired = '1';
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      if (panel) panel.hidden = !open;
    });
  }
}

/** Renders FAQ items in the design's accordion markup. */
export function renderFaqs(
  container: HTMLElement,
  items: [string, string][],
  idPrefix: string
): void {
  container.innerHTML = items
    .map(
      ([q, a], i) => `
      <div style="border-bottom: 1px solid #E6EBF2;">
        <h3 style="margin: 0;">
          <button type="button" class="faq-toggle" aria-expanded="false" aria-controls="${idPrefix}-${i}" style="width: 100%; min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; border: none; background: transparent; font-family: inherit; font-size: clamp(15px, 1.3vw, 17px); font-weight: 500; color: #0E2C52; text-align: left; cursor: pointer;">
            ${esc(q)}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink: 0;"><path d="M12 5v14M5 12h14"></path></svg>
          </button>
        </h3>
        <p id="${idPrefix}-${i}" hidden style="margin: 0; padding: 0 40px 20px 0; font-size: 16px; line-height: 1.65; color: #56657C;">${esc(a)}</p>
      </div>`
    )
    .join('');
  wireAccordions(container);
}

/** Two-button Monthly/Yearly toggle in the design's pill style. Calls back with the new value. */
export function wireBillingToggle(
  group: HTMLElement,
  onChange: (billing: 'monthly' | 'yearly') => void,
  initial: 'monthly' | 'yearly' = 'monthly'
): void {
  const buttons = $all('button[data-billing]', group);
  const apply = (value: 'monthly' | 'yearly') => {
    for (const b of buttons) {
      const on = b.dataset.billing === value;
      b.setAttribute('aria-pressed', String(on));
      b.style.background = on ? '#0E2C52' : 'transparent';
      b.style.color = on ? '#FFFFFF' : '#0E2C52';
    }
    onChange(value);
  };
  for (const b of buttons) {
    b.addEventListener('click', () => apply(b.dataset.billing === 'yearly' ? 'yearly' : 'monthly'));
  }
  apply(initial);
}
