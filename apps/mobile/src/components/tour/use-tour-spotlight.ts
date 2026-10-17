/**
 * Budget Buddy's tour spotlight. Native has no page to dim, so this is a
 * no-op there; the web version (`use-tour-spotlight.web.ts`) draws the
 * dimming overlay and cutouts.
 */
export interface TourSpotlightOptions {
  /** Overlay is drawn only while true. */
  active: boolean;
  /** Element ids (nativeID) to keep bright and usable. */
  targetIds: string[];
  /** nativeID of the Budget Buddy panel, which always stays usable. */
  panelId: string;
  reducedMotion: boolean;
  /** Escape pressed while the spotlight is up. */
  onEscape: () => void;
}

export function useTourSpotlight(_options: TourSpotlightOptions): void {}
