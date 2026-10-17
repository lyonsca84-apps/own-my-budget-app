import { Brand, Colors } from '@/constants/theme';

/**
 * Credit-card art comes straight from the Enkel Solar brand colors — no
 * off-palette hex. Each style is a fixed pairing chosen so its text color
 * holds contrast across the whole face (light text only on Panel/Sky
 * gradients, Panel ink on the lighter ones).
 */
export type CardTextMode = 'auto' | 'light' | 'dark';

export interface CardStyleDef {
  key: string;
  label: string;
  /** One color = solid face; two = a diagonal gradient. */
  colors: readonly [string] | readonly [string, string];
  /** Which text color reads best on this face when the user leaves text on Automatic. */
  autoText: 'light' | 'dark';
}

export const CARD_STYLES: readonly CardStyleDef[] = [
  {
    key: 'navySky',
    label: 'Navy and sky blue',
    colors: [Brand.panel, Brand.sky],
    autoText: 'light',
  },
  {
    key: 'skyNavy',
    label: 'Sky blue and navy',
    colors: [Brand.sky, Brand.panel],
    autoText: 'light',
  },
  { key: 'panel', label: 'Solid navy', colors: [Brand.panel], autoText: 'light' },
  { key: 'sky', label: 'Solid sky blue', colors: [Brand.sky], autoText: 'light' },
  {
    key: 'electricityEcology',
    label: 'Teal and green',
    colors: [Brand.electricity, Brand.ecology],
    autoText: 'dark',
  },
  {
    key: 'electricityEnergy',
    label: 'Teal and lime',
    colors: [Brand.electricity, Brand.energy],
    autoText: 'dark',
  },
  {
    key: 'energyEcology',
    label: 'Lime and green',
    colors: [Brand.energy, Brand.ecology],
    autoText: 'dark',
  },
  { key: 'sunEnergy', label: 'Sun and lime', colors: [Brand.sun, Brand.energy], autoText: 'dark' },
];

export const DEFAULT_CARD_STYLE_KEY = 'navySky';

export function resolveCardStyle(key: string | null | undefined): CardStyleDef {
  return CARD_STYLES.find((s) => s.key === key) ?? CARD_STYLES[0];
}

/** Text + chip colors for a card face, honoring the user's Light/Dark text override. */
export function cardForeground(
  key: string | null | undefined,
  mode: CardTextMode | string | null | undefined
): string {
  const light = Colors.light.onPanel;
  const dark = Brand.panel;
  if (mode === 'light') return light;
  if (mode === 'dark') return dark;
  return resolveCardStyle(key).autoText === 'light' ? light : dark;
}

export const CARD_NETWORKS = [
  'Not specified',
  'Visa',
  'Mastercard',
  'American Express',
  'Discover',
];

interface Bank {
  name: string;
  initials: string;
  aliases: string[];
}

const BANKS: Bank[] = [
  {
    name: 'Bank of America',
    initials: 'BA',
    aliases: ['bank of america', 'bank america', 'boa', 'bofa', 'b of a', 'bank of am'],
  },
  {
    name: 'Chase',
    initials: 'CH',
    aliases: ['chase', 'jp morgan chase', 'jpmorgan chase', 'jpmorgan', 'jp morgan'],
  },
  { name: 'Citi', initials: 'CI', aliases: ['citi', 'citibank', 'citi bank', 'citicards'] },
  { name: 'Discover', initials: 'DI', aliases: ['discover', 'discover it', 'discover card'] },
  {
    name: 'Capital One',
    initials: 'C1',
    aliases: ['capital one', 'capitalone', 'cap one', 'c1'],
  },
  { name: 'Wells Fargo', initials: 'WF', aliases: ['wells fargo', 'wellsfargo', 'wells'] },
  { name: 'American Express', initials: 'AX', aliases: ['american express', 'amex', 'am ex'] },
  {
    name: 'Navy Federal Credit Union',
    initials: 'NF',
    aliases: ['navy federal', 'navy federal credit union', 'nfcu', 'navyfed'],
  },
  { name: 'Synchrony', initials: 'SY', aliases: ['synchrony', 'synchrony bank', 'syncb'] },
  { name: 'Apple Card', initials: 'AP', aliases: ['apple', 'apple card', 'apple credit'] },
  { name: "Sam's Club", initials: 'SC', aliases: ["sam's club", 'sams club', 'sams', 'samsclub'] },
];

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Recognizes common issuers from free text so a typed "chase" or "BofA" gets a proper name and badge. */
export function matchBank(raw: string | null | undefined): Bank | null {
  const query = normalize(raw ?? '');
  if (!query) return null;
  let best: { bank: Bank; score: number } | null = null;
  for (const bank of BANKS) {
    for (const alias of bank.aliases) {
      if (query === alias) return bank;
      if (query.includes(alias) && (!best || best.score < alias.length)) {
        best = { bank, score: alias.length };
      }
    }
  }
  return best ? best.bank : null;
}

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export interface CardIdentity {
  bankLabel: string;
  badgeInitials: string;
  maskedNumber: string;
  networkLabel: string | null;
}

export function cardIdentity(input: {
  issuer: string | null;
  last4: string | null;
  network: string | null;
}): CardIdentity {
  const bank = matchBank(input.issuer);
  return {
    bankLabel: bank ? bank.name : input.issuer || 'Bank not set',
    badgeInitials: bank ? bank.initials : initialsOf(input.issuer),
    maskedNumber: input.last4 ? `•••• ${input.last4}` : '•••• ••••',
    networkLabel: input.network && input.network !== 'Not specified' ? input.network : null,
  };
}
