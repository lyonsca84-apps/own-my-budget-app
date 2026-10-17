import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Semantic meaning of a status. In the design's status vocabulary:
 *
 * | tone      | filled color  | used for                                   |
 * | --------- | ------------- | ------------------------------------------ |
 * | `success` | green         | Paid, Completed, Reached                   |
 * | `warning` | mustard/olive | Due, Upcoming, Needs Attention             |
 * | `info`    | blue          | Partial, Partially Paid                    |
 * | `danger`  | clay (rust)   | Overdue, Past Due, Behind Schedule         |
 * | `accent`  | teal          | On Track                                   |
 * | `neutral` | gray          | informational (Not Started, Paused…)       |
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export interface StatusPillProps {
  label: string;
  /**
   * `danger` is the clay/rust color, never bright red — overspending is a calm
   * watch state, only genuinely overdue or behind-schedule items use clay.
   */
  tone: StatusTone;
  /**
   * Solid-fill look used by the approved design (Paid / Due / Partial /
   * Overdue): a saturated background with white text. Default is the softer
   * tinted-background look.
   */
  filled?: boolean;
}

const SOFT: Record<StatusTone, { fg: ThemeColor; bg: ThemeColor }> = {
  success: { fg: 'success', bg: 'successMuted' },
  warning: { fg: 'warning', bg: 'warningMuted' },
  danger: { fg: 'clay', bg: 'clayMuted' },
  info: { fg: 'primary', bg: 'primaryMuted' },
  accent: { fg: 'solidAccent', bg: 'accentMuted' },
  neutral: { fg: 'textSecondary', bg: 'backgroundSelected' },
};

const SOLID: Record<StatusTone, ThemeColor> = {
  success: 'solidSuccess',
  warning: 'solidWarning',
  danger: 'solidDanger',
  info: 'solidInfo',
  accent: 'solidAccent',
  neutral: 'textSecondary',
};

export function StatusPill({ label, tone, filled = false }: StatusPillProps) {
  const theme = useTheme();

  if (filled) {
    return (
      <View
        accessible
        accessibilityLabel={`Status: ${label}`}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: theme[SOLID[tone]],
          borderRadius: Radius.chip,
          paddingVertical: 4,
          paddingHorizontal: 12,
        }}
      >
        <ThemedText
          type="smallBold"
          style={{
            color: tone === 'neutral' ? theme.background : theme.onSolid,
            fontFamily: Fonts.body.bold,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {label}
        </ThemedText>
      </View>
    );
  }

  const colors = SOFT[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme[colors.bg],
        borderRadius: Radius.full,
        paddingVertical: 7,
        paddingHorizontal: Spacing.three,
      }}
    >
      <ThemedText type="smallBold" themeColor={colors.fg}>
        {label}
      </ThemedText>
    </View>
  );
}
