/**
 * The app is light-mode only for now — see use-color-scheme.ts. Returning a
 * constant also keeps the statically rendered HTML and the hydrated client
 * identical, so there is no flash of the wrong palette.
 */
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
