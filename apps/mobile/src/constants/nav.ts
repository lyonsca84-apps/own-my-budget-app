import type { Href } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * Every primary section is a real tab route so `expo-router/ui`'s `Tabs`
 * navigator can register it — but the *visible* nav button set differs by
 * layout:
 *
 * - Web sidebar (wide): 6 items matching the approved Claude design —
 *   Dashboard, Budget, Bills & Debt, Savings & Goals, Grocery, Reports.
 *   Grocery/Reports are plain links (not tab routes, see app-tabs.web.tsx),
 *   and the `more` tab is hidden since its contents are already visible
 *   directly.
 * - Mobile bottom bar (narrow web + native): 5 tabs — Home, Budget, Bills,
 *   Goals, More (Grocery + Reports live inside More).
 *
 * The AI Helper is intentionally not a tab on either layout — it's reached
 * via a persistent card (sidebar) or floating button (mobile), matching the
 * approved design, and its screen lives outside the tab group entirely.
 */
export interface NavItem {
  name: string;
  href: Href;
  /** Label shown in the wide web sidebar. */
  wideLabel: string;
  /** Label shown in the narrow mobile tab bar. */
  narrowLabel: string;
  sfSymbol: SFSymbol;
  sfSymbolFilled: SFSymbol;
  /** Not shown as a sidebar item on wide layouts — its content is already directly reachable there. */
  hideOnWide?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    name: 'index',
    href: '/',
    wideLabel: 'Dashboard',
    narrowLabel: 'Home',
    sfSymbol: 'house',
    sfSymbolFilled: 'house.fill',
  },
  {
    name: 'plan',
    href: '/plan',
    wideLabel: 'Budget',
    narrowLabel: 'Budget',
    sfSymbol: 'chart.pie',
    sfSymbolFilled: 'chart.pie.fill',
  },
  {
    name: 'bills',
    href: '/bills',
    wideLabel: 'Bills & Debt',
    narrowLabel: 'Bills',
    sfSymbol: 'doc.text',
    sfSymbolFilled: 'doc.text.fill',
  },
  {
    name: 'money',
    href: '/money',
    wideLabel: 'Savings & Goals',
    narrowLabel: 'Goals',
    sfSymbol: 'banknote',
    sfSymbolFilled: 'banknote.fill',
  },
  {
    name: 'more',
    href: '/more',
    wideLabel: 'More',
    narrowLabel: 'More',
    sfSymbol: 'ellipsis.circle',
    sfSymbolFilled: 'ellipsis.circle.fill',
    hideOnWide: true,
  },
];

/** Extra links shown only in the wide web sidebar, alongside the tab items above. */
export const WIDE_EXTRA_LINKS: { label: string; href: Href }[] = [
  { label: 'Grocery', href: '/grocery-list' },
  { label: 'Reports', href: '/reports' },
];
