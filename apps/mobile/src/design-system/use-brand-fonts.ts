import { useFonts } from 'expo-font';

import { FontsToLoad } from '@/constants/theme';

/** Loads the exact weight-specific families named by the design handoff. */
export function useBrandFonts() {
  return useFonts(FontsToLoad);
}
