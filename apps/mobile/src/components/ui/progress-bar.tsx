import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ProgressTone = 'primary' | 'success' | 'watch';

const TONE_COLOR: Record<ProgressTone, ThemeColor> = {
  primary: 'primary',
  success: 'successSolid',
  watch: 'warningSolid',
};

export interface ProgressBarProps {
  /** 0–100. Values outside that range are clamped. */
  percent: number;
  tone?: ProgressTone;
}

/** The pill-shaped linear progress track used for bill and goal amounts. */
export function ProgressBar({ percent, tone = 'primary' }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <View
      style={{
        height: 8,
        borderRadius: Radius.full,
        backgroundColor: theme.backgroundSelected,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: theme[TONE_COLOR[tone]],
          borderRadius: Radius.full,
        }}
      />
    </View>
  );
}

export interface ProgressRingProps {
  /** 0–100. Values outside that range are clamped. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

/** The circular ring used on savings-goal cards — the percentage sits at its center. */
export function ProgressRing({ percent, size = 96, strokeWidth = 12, color }: ProgressRingProps) {
  const theme = useTheme();
  const ringColor = color ?? theme.primary;
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={theme.backgroundSelected}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>
        <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 26 }}>
          {Math.round(clamped)}%
        </ThemedText>
      </View>
    </View>
  );
}
