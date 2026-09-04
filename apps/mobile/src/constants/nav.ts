import type { Href } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * The 5 primary sections, per PLAN.md §3: "Mobile uses a 5-tab bar; web uses
 * a left sidebar with the same sections in wider layouts." Grocery and
 * Reports are reachable from within Money/Home rather than being separate
 * top-level items — PLAN.md's own nav spec (identical sections on both
 * platforms) takes priority over the design canvas's 6-item web sidebar.
 */
export interface NavItem {
  name: string;
  href: Href;
  label: string;
  sfSymbol: SFSymbol;
  sfSymbolFilled: SFSymbol;
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'index', href: '/', label: 'Home', sfSymbol: 'house', sfSymbolFilled: 'house.fill' },
  {
    name: 'plan',
    href: '/plan',
    label: 'Plan',
    sfSymbol: 'chart.pie',
    sfSymbolFilled: 'chart.pie.fill',
  },
  {
    name: 'bills',
    href: '/bills',
    label: 'Bills',
    sfSymbol: 'doc.text',
    sfSymbolFilled: 'doc.text.fill',
  },
  {
    name: 'money',
    href: '/money',
    label: 'Money',
    sfSymbol: 'banknote',
    sfSymbolFilled: 'banknote.fill',
  },
  // sparkles has no distinct filled variant in SF Symbols — same glyph both states.
  {
    name: 'helper',
    href: '/helper',
    label: 'Helper',
    sfSymbol: 'sparkles',
    sfSymbolFilled: 'sparkles',
  },
];
