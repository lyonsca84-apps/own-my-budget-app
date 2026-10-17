/**
 * The app is light-mode only for now. Every screen reads the scheme through
 * this hook (or `useTheme`, which wraps it), so pinning it here keeps the
 * whole UI on the light palette regardless of the device or browser setting.
 * The dark palette in `constants/theme.ts` is kept for when dark mode ships;
 * to re-enable it, return `useColorScheme()` from 'react-native' here and in
 * `use-color-scheme.web.ts`, and set `userInterfaceStyle` back to "automatic".
 */
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
