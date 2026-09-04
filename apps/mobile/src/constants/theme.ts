/**
 * Own My Budget design tokens.
 *
 * Colors are extracted from the approved Claude Design canvas (Dashboard, Budget,
 * Bills & Debt, Savings, Grocery, Reports — see design/handoff/) plus PLAN.md's
 * "calm palette" spec (soft sage = on track, warm amber = watch this, muted clay =
 * overdue). `budgetBuddy` (purple) is a deliberate addition, not in the original
 * canvas: per product decision, blue/teal stays primary everywhere, and purple is
 * reserved as the signature accent for Budget Buddy (AI) touchpoints and
 * premium/upgrade moments, so it reads as a distinct feature rather than a
 * competing brand color. Dark mode was not covered by the design pass; the dark
 * palette below extends the light one by inverting the brand's own ink/paper pair
 * (#00182F becomes the dark background, #F7F9F8 becomes dark-mode text) and
 * brightening each accent just enough to hold WCAG AA contrast on that background.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Base surfaces
    text: '#00182F',
    textSecondary: '#6B7280',
    background: '#F7F9F8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EAF1F5',
    border: '#E6EBEA',

    // Brand — blue/teal stays primary across the whole app
    primary: '#0B6FB8',
    primaryMuted: '#D9E7F8',
    accent: '#1598EC',
    accentMuted: '#D7F0EF',

    // Status — matches PLAN.md's "never shame" palette
    success: '#2F8F4E',
    successMuted: '#D7F0EF',
    warning: '#8A6D00',
    warningMuted: '#FFF6D2',
    danger: '#A8431B',
    dangerMuted: '#FDF0E8',

    // Budget Buddy (AI) / premium accent — purple, used sparingly
    budgetBuddy: '#6D5BD0',
    budgetBuddyMuted: '#F4F2FB',
  },
  dark: {
    text: '#F7F9F8',
    textSecondary: '#9CA8B4',
    background: '#00182F',
    backgroundElement: '#0B2A47',
    backgroundSelected: '#123655',
    border: '#1C3A54',

    primary: '#4CA6E0',
    primaryMuted: '#123655',
    accent: '#3FCBE0',
    accentMuted: '#0F3A3D',

    success: '#5BC97D',
    successMuted: '#123B26',
    warning: '#E8C158',
    warningMuted: '#3A2F0C',
    danger: '#E8825A',
    dangerMuted: '#3A1D10',

    budgetBuddy: '#A594F2',
    budgetBuddyMuted: '#241F42',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
