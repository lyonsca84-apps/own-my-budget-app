import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusPillProps {
  label: string;
  /**
   * 'success' = on track (sage), 'warning' = watch this (amber, never red),
   * 'danger' = genuinely overdue (muted clay), 'neutral' = informational.
   * Matches PLAN.md's "never shame" rule — overspending is amber, not red.
   */
  tone: StatusTone;
}

const TONE_COLORS: Record<StatusTone, { fg: ThemeColor; bg: ThemeColor }> = {
  success: { fg: 'success', bg: 'successMuted' },
  warning: { fg: 'warning', bg: 'warningMuted' },
  danger: { fg: 'danger', bg: 'dangerMuted' },
  neutral: { fg: 'textSecondary', bg: 'backgroundSelected' },
};

export function StatusPill({ label, tone }: StatusPillProps) {
  const theme = useTheme();
  const colors = TONE_COLORS[tone];

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
