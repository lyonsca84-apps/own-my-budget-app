/** Public design-system entry point for new screen and component work. */
export * from '@/constants/theme';
export * from './use-brand-fonts';

// Import image groups from `@/design-system/assets/<group>` so Metro does not
// pull every large binary asset into a screen that only needs design tokens.
