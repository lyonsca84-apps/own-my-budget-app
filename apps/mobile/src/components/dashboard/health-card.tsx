import type { HealthBand, MonthlyHealth } from '@own-my-budget/core';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Caption, CardTitle, DashCard } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Brand, Fonts, Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BAND_COLOR: Record<HealthBand, ThemeColor> = {
  excellent: 'solidAccent',
  doingWell: 'success',
  makingProgress: 'energyText',
  gettingStarted: 'warning',
  needsAttention: 'clay',
};

/** Polar-to-cartesian point on the gauge's semicircle (180° left … 0° right). */
function pointOnArc(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function Gauge({ score, label }: { score: number; label: string }) {
  const theme = useTheme();
  const width = 240;
  const height = 132;
  const stroke = 26;
  const cx = width / 2;
  const cy = 118;
  const r = 100;
  const start = pointOnArc(cx, cy, r, 180);
  const end = pointOnArc(cx, cy, r, 0);
  const tip = pointOnArc(cx, cy, r - stroke / 2 - 4, 180 - (score / 100) * 180);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Budget health score ${score} out of 100, ${label}`}
      style={{ width, height }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="dash-health-gauge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={theme.clay} />
            <Stop offset="25%" stopColor={Brand.sun} />
            <Stop offset="50%" stopColor={Brand.energy} />
            <Stop offset="75%" stopColor={Brand.ecology} />
            <Stop offset="100%" stopColor={Brand.electricity} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="url(#dash-health-gauge)"
          strokeWidth={stroke}
        />
        <Path
          d={`M ${cx} ${cy} L ${tip.x} ${tip.y}`}
          stroke={theme.text}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={6} fill={theme.text} />
      </Svg>
    </View>
  );
}

export interface HealthCardProps {
  health: MonthlyHealth;
  change: { text: string; tone: 'good' | 'watch' | 'neutral' };
  improveTips: string[];
}

/** Budget Health Score gauge with the "i" explainer and the See How to Improve list. */
export function HealthCard({ health, change, improveTips }: HealthCardProps) {
  const theme = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);
  const changeColor: ThemeColor =
    change.tone === 'good' ? 'success' : change.tone === 'watch' ? 'warning' : 'textSecondary';

  return (
    <DashCard style={{ gap: Space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <CardTitle>Budget Health Score</CardTitle>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How this score is calculated"
          aria-expanded={infoOpen}
          onPress={() => setInfoOpen((open) => !open)}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: theme.controlBorder,
            backgroundColor: infoOpen ? theme.backgroundSelected : theme.backgroundElement,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText style={{ fontFamily: Fonts.body.bold, fontSize: 14, lineHeight: 18 }}>
            i
          </ThemedText>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <Gauge score={health.score} label={health.label} />
        <ThemedText
          style={{
            fontFamily: Fonts.heading.bold,
            fontSize: 40,
            lineHeight: 46,
            marginTop: -6,
            fontVariant: ['tabular-nums'],
          }}
          accessibilityElementsHidden
        >
          {health.score}
        </ThemedText>
        <ThemedText
          themeColor={BAND_COLOR[health.band]}
          style={{ fontFamily: Fonts.body.bold, fontSize: 15, lineHeight: 22 }}
        >
          {health.label}
        </ThemedText>
        <Caption style={{ textAlign: 'center', marginTop: 4 }}>{health.note}</Caption>
        <Caption bold color={changeColor} style={{ textAlign: 'center' }}>
          {change.text}
        </Caption>
      </View>

      {infoOpen ? (
        <View
          style={{
            backgroundColor: theme.backgroundSelected,
            borderRadius: Radius.input,
            padding: Space[3],
          }}
        >
          <Caption color="text">
            Six equally weighted factors: bills paid on time, spending against your budget, savings
            progress, debt payment progress, income remaining, and overdue payments.
          </Caption>
        </View>
      ) : null}

      <Caption style={{ fontSize: 13, lineHeight: 19 }}>
        Your Budget Health Score is an educational estimate designed to help you understand your
        budgeting progress. It is not financial advice or a credit score.
      </Caption>

      <Button
        label="See How to Improve"
        variant="panel"
        shape="rounded"
        aria-expanded={improveOpen}
        onPress={() => setImproveOpen((open) => !open)}
      />

      {improveOpen ? (
        <View style={{ gap: Space[2] }}>
          {improveTips.map((tip) => (
            <View
              key={tip}
              style={{
                backgroundColor: theme.energyMuted,
                borderRadius: Radius.input,
                paddingVertical: Space[3],
                paddingHorizontal: Space[3],
              }}
            >
              <Caption color="text">{tip}</Caption>
            </View>
          ))}
        </View>
      ) : null}
    </DashCard>
  );
}
