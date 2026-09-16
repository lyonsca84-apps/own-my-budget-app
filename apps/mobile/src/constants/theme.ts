/**
 * Own My Budget design tokens.
 *
 * Source of truth: "Own My Budget Design System" v1.0 (August 2026), exported
 * from Claude Design to Branding/Brand Guidelines/Own My Budget_ design
 * system.zip. That doc moves the product onto the Enkel Solar palette — a
 * warm-neutral page, deep Panel navy for ink, and six saturated brand colors
 * each reserved for one job (Sun = highlight only, Energy = money available,
 * Ecology = on track, Electricity = secondary accent/spending, Sky =
 * interaction/links/primary actions, Panel = text and dark surfaces).
 *
 * Budget Buddy now uses the supplied Electricity-to-Sky treatment so it stays
 * inside the six-color system instead of introducing a competing purple.
 *
 * Dark mode isn't covered by the design doc; the dark palette below extends
 * the light one by inverting the brand's own ink/paper pair (Panel #001228
 * becomes the dark background, Page #F7F6F3 becomes dark-mode text) and
 * brightening each accent just enough to hold WCAG AA contrast on that
 * background.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

/**
 * The six Enkel Solar brand colors, exposed raw for call sites that need the
 * fixed category mapping the design system specifies for charts and badges
 * (Bills=Panel, Debt=Sky, Groceries=Electricity, Savings=Ecology,
 * Available=Energy) rather than a semantic UI role.
 */
export const Brand = {
  sun: '#F5D500',
  energy: '#C6D14F',
  ecology: '#84C08B',
  electricity: '#01ACD3',
  sky: '#006AFF',
  panel: '#001228',
} as const;

export const Colors = {
  light: {
    // Base surfaces — warm-neutral Page under cool navy ink.
    text: '#001228',
    textSecondary: '#4A5A6B',
    caption: '#62707E',
    disabled: '#7C8894',
    background: '#F7F6F3',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFEEE9',
    disabledSurface: '#EFEEE9',
    border: '#E4E3DE',
    // Input/button outline — a step darker than the Line divider color above,
    // matching the design system's distinct "control border" swatch.
    controlBorder: '#D5D9DC',

    panel: '#001228',
    onPanel: '#FFFFFF',

    // Brand — Sky carries interaction (links, primary buttons, focus rings).
    primary: '#006AFF',
    onPrimary: '#FFFFFF',
    primaryMuted: '#E0EDFF',
    accent: '#01ACD3',
    accentMuted: '#DFF4F9',
    energy: '#C6D14F',
    energyMuted: '#F2F5DA',
    energyText: '#6E7A16',
    sun: '#F5D500',

    // Semantic — tint for backgrounds, deep shade for text/icons. Every pair
    // clears 4.5:1. Per explicit product direction, danger reads as real red
    // and a healthy/positive state reads as real green — most notably on the
    // Budget Health Score gauge, where "in the red" vs. "going great" needs
    // to be legible at a glance. `warning` stays the calm amber "watch this"
    // middle ground (e.g. a bill that's due soon, not yet overdue).
    success: '#1E7A3C',
    successSolid: '#1FA34C',
    successMuted: '#E5F6EA',
    warning: '#7A5D00',
    warningSolid: '#B08900',
    warningMuted: '#FBF3D0',
    danger: '#C0261A',
    dangerSolid: '#DC2626',
    dangerMuted: '#FDECEA',

    budgetBuddy: '#01ACD3',
    budgetBuddyMuted: '#E1F6FB',
  },
  dark: {
    text: '#F7F6F3',
    textSecondary: '#B7C2CC',
    caption: '#A9B4BE',
    disabled: '#7C8894',
    background: '#001228',
    backgroundElement: '#0A2039',
    backgroundSelected: '#0F2A47',
    disabledSurface: '#26394D',
    border: '#1C3A54',
    controlBorder: '#2B4A63',

    panel: '#F7F6F3',
    onPanel: '#001228',

    primary: '#3F93FF',
    // The dark-mode primary is brightened for visibility on a dark
    // background, which means white text no longer has enough contrast on
    // top of it — dark ink reads better here than on the light-mode Sky.
    onPrimary: '#001228',
    primaryMuted: '#123655',
    accent: '#2FC4E8',
    accentMuted: '#0F3A3D',
    energy: '#D7E177',
    energyMuted: '#394018',
    energyText: '#D7E177',
    sun: '#FFE45B',

    success: '#4ADE80',
    successSolid: '#22C55E',
    successMuted: '#123B26',
    warning: '#E8C158',
    warningSolid: '#D0AA32',
    warningMuted: '#3A2F0C',
    danger: '#F87171',
    dangerSolid: '#EF4444',
    dangerMuted: '#3F1414',

    budgetBuddy: '#5FCDE4',
    budgetBuddyMuted: '#123D47',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Poppins carries headings and money amounts — its geometry keeps large
 * numerals legible at a glance. Figtree handles everything read as a
 * sentence. IBM Plex Mono is reserved for eyebrows, section labels and raw
 * data (account numbers, code). Weight-specific family names are required by
 * expo-font for statically-loaded (non-variable) web fonts — set `fontFamily`
 * to the exact weight you need rather than pairing a base family with
 * `fontWeight`.
 */
export const Fonts = {
  heading: {
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
  },
  body: {
    regular: 'Figtree_400Regular',
    medium: 'Figtree_500Medium',
    semibold: 'Figtree_600SemiBold',
    bold: 'Figtree_700Bold',
  },
  mono: {
    regular: 'IBMPlexMono_400Regular',
    medium: 'IBMPlexMono_500Medium',
  },
} as const;

/** Font families to hand to `useFonts()` in the root layout. */
export const FontsToLoad = {
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  Poppins_700Bold: require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
  Figtree_400Regular: require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),
  Figtree_500Medium: require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  Figtree_600SemiBold: require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  Figtree_700Bold: require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
  IBMPlexMono_400Regular: require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'),
  IBMPlexMono_500Medium: require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'),
};

export const Typography = {
  display: {
    fontFamily: Fonts.heading.bold,
    fontSize: 64,
    lineHeight: 67,
    letterSpacing: -1.92,
    fontVariant: ['tabular-nums'],
  },
  h1: {
    fontFamily: Fonts.heading.bold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  h2: {
    fontFamily: Fonts.heading.semibold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.26,
  },
  amount: {
    fontFamily: Fonts.heading.bold,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.34,
    fontVariant: ['tabular-nums'],
  },
  /** Row-level money (bill/debt/paycheck list rows) — Poppins 600/18, per the handoff's bill-row anatomy. */
  amountSmall: {
    fontFamily: Fonts.heading.semibold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.18,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: Fonts.body.semibold,
    fontSize: 17,
    lineHeight: 24,
  },
  body: {
    fontFamily: Fonts.body.regular,
    fontSize: 17,
    lineHeight: 27,
  },
  caption: {
    fontFamily: Fonts.body.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  eyebrow: {
    fontFamily: Fonts.body.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.56,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

/** Canonical 4px grid from the handoff. */
export const Space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  7: 28,
  12: 48,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii from the design system's "Radius" scale. */
export const Radius = {
  chip: 8,
  input: 12,
  smallCard: 16,
  card: 20,
  hero: 24,
  full: 999,
} as const;

export const Layout = {
  minimumTouchTarget: 44,
  controlHeight: 52,
  cardPadding: Space[7],
  cardGap: Space[5],
  sectionGap: Space[12],
  contentMaxWidth: 1360,
  sidebarWidth: 264,
} as const;

export const Motion = {
  quick: 160,
  standard: 180,
  easing: [0.2, 0.8, 0.3, 1],
} as const;

export const ChartColors = {
  bills: Brand.panel,
  debt: Brand.sky,
  groceries: Brand.electricity,
  savings: Brand.ecology,
  available: Brand.energy,
} as const;

export const SignatureGradient = {
  angle: 105,
  stops: ['#CFE4FF', '#E8F3E4', '#F3F0BC', '#DDEBB9'],
  css: 'linear-gradient(105deg, #CFE4FF 0%, #E8F3E4 38%, #F3F0BC 62%, #DDEBB9 100%)',
} as const;

/**
 * Cards float on a Panel-tinted shadow rather than a border — shadows are
 * always tinted with the ink color, never neutral black.
 */
export const CardShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(0,18,40,.04), 0 8px 24px rgba(0,18,40,.05)' },
  default: {
    shadowColor: '#001228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = Layout.contentMaxWidth;
