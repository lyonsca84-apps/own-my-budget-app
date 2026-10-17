import { router } from 'expo-router';
import type { BudgetHealthResult } from '@own-my-budget/core';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TONE_COLOR: Record<BudgetHealthResult['tone'], ThemeColor> = {
  danger: 'danger',
  watch: 'warning',
  positive: 'success',
};

/** Polar-to-cartesian point on the gauge's semicircle (180°-0°, left to right). */
function pointOnArc(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) };
}

export interface BudgetHealthGaugeProps {
  health: BudgetHealthResult;
}

/**
 * The dashboard's Budget Health Score — an educational estimate built from
 * the user's own numbers (cash cushion, bills on track, debt load, savings
 * progress). Explicitly not a credit score and not financial advice; the
 * gauge runs red -> amber -> green so "in the red" and "going great" are
 * both readable at a glance, per product direction.
 */
export function BudgetHealthGauge({ health }: BudgetHealthGaugeProps) {
  const theme = useTheme();
  const size = 220;
  const strokeWidth = 22;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = size / 2 - strokeWidth / 2 - 4;

  const needleAngle = 180 - (health.score / 100) * 180;
  const needleTip = pointOnArc(cx, cy, r - strokeWidth / 2 - 2, needleAngle);
  const trackStart = pointOnArc(cx, cy, r, 180);
  const trackEnd = pointOnArc(cx, cy, r, 0);

  return (
    <Card style={{ alignItems: 'center', gap: Space[2] }}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Budget Health Score
      </ThemedText>

      <View style={{ width: size, height: size / 2 + 30, alignItems: 'center' }}>
        <Svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
          <Defs>
            <LinearGradient id="health-gauge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={theme.dangerSolid} />
              <Stop offset="50%" stopColor={theme.warningSolid} />
              <Stop offset="100%" stopColor={theme.successSolid} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`}
            fill="none"
            stroke="url(#health-gauge)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d={`M ${cx} ${cy} L ${needleTip.x} ${needleTip.y}`}
            stroke={theme.text}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Path d={`M ${cx - 7} ${cy} a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0`} fill={theme.text} />
        </Svg>
        <View style={{ position: 'absolute', bottom: -6, alignItems: 'center' }}>
          <ThemedText type="display">{health.score}</ThemedText>
        </View>
      </View>

      <ThemedText type="smallBold" themeColor={TONE_COLOR[health.tone]}>
        {health.label}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 280 }}>
        {health.summary}
      </ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={{ textAlign: 'center', maxWidth: 280 }}
      >
        An educational estimate based on your own numbers — not financial advice, and not a credit
        score.
      </ThemedText>
      <Button label="See how to improve" variant="quiet" onPress={() => router.push('/reports')} />
    </Card>
  );
}
