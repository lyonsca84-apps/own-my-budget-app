import type { HealthBand, MonthlyHealth } from '@own-my-budget/core';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Caption, DashCard } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
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
  const width = 380;
  const height = 200;
  const stroke = 40;
  const cx = width / 2;
  const cy = 180;
  const r = 150;
  const start = pointOnArc(cx, cy, r, 180);
  const end = pointOnArc(cx, cy, r, 0);
  const tip = pointOnArc(cx, cy, r - stroke / 2 - 6, 180 - (score / 100) * 180);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Budget health score ${score} out of 100, ${label}`}
      style={{ width, height, maxWidth: '100%' }}
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
          strokeLinecap="round"
        />
        <Path
          d={`M ${cx} ${cy} L ${tip.x} ${tip.y}`}
          stroke={theme.text}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={9} fill={theme.text} />
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
    <DashCard style={{ gap: Space[5] }} padding={Space[7]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ThemedText
          accessibilityRole="header"
          style={{ fontFamily: Fonts.heading.bold, fontSize: 26, lineHeight: 32 }}
        >
          Budget Health Score
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How this score is calculated"
          aria-expanded={infoOpen}
          onPress={() => setInfoOpen((open) => !open)}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: theme.controlBorder,
            backgroundColor: infoOpen ? theme.backgroundSelected : theme.backgroundElement,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText style={{ fontFamily: Fonts.body.bold, fontSize: 16, lineHeight: 20 }}>
            i
          </ThemedText>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', gap: 4 }}>
        <Gauge score={health.score} label={health.label} />
        <ThemedText
          style={{
            fontFamily: Fonts.heading.bold,
            fontSize: 68,
            lineHeight: 76,
            marginTop: -10,
            fontVariant: ['tabular-nums'],
          }}
          accessibilityElementsHidden
        >
          {health.score}
        </ThemedText>
        <ThemedText
          themeColor={BAND_COLOR[health.band]}
          style={{ fontFamily: Fonts.body.bold, fontSize: 22, lineHeight: 28, marginTop: 2 }}
        >
          {health.label}
        </ThemedText>
        <Caption style={{ fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 8 }}>
          {health.note}
        </Caption>
        <Caption
          bold
          color={changeColor}
          style={{ fontSize: 17, lineHeight: 24, textAlign: 'center' }}
        >
          {change.text}
        </Caption>
      </View>

      {infoOpen ? (
        <View
          style={{
            backgroundColor: theme.backgroundSelected,
            borderRadius: Radius.input,
            padding: Space[4],
          }}
        >
          <Caption color="text" style={{ fontSize: 15, lineHeight: 21 }}>
            Six equally weighted factors: bills paid on time, spending against your budget, savings
            progress, debt payment progress, income remaining, and overdue payments.
          </Caption>
        </View>
      ) : null}

      <Caption style={{ fontSize: 16, lineHeight: 24 }}>
        Your Budget Health Score is an educational estimate designed to help you understand your
        budgeting progress. It is not financial advice or a credit score.
      </Caption>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See how to improve your budget health score"
        aria-expanded={improveOpen}
        onPress={() => setImproveOpen((open) => !open)}
        style={({ pressed }) => ({
          minHeight: 64,
          borderRadius: Radius.smallCard,
          backgroundColor: theme.panel,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <ThemedText
          style={{
            color: theme.onPanel,
            fontFamily: Fonts.body.bold,
            fontSize: 18,
            lineHeight: 24,
          }}
        >
          See How to Improve
        </ThemedText>
      </Pressable>

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
