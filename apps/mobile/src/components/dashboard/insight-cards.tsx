import type { MissionStatus } from '@own-my-budget/core';
import { useState } from 'react';
import { View } from 'react-native';

import { Bar, Caption, ChipButton, DashCard } from '@/components/dashboard/common';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Tip for you" — one tip at a time, cycled with Next tip. */
export function TipCard({ tips }: { tips: string[] }) {
  const [index, setIndex] = useState(0);
  const tip = tips[index % Math.max(1, tips.length)] ?? '';
  return (
    <DashCard
      title="Tip for you"
      padding={20}
      action={
        <ChipButton
          label="Next tip"
          tone="soft"
          onPress={() => setIndex((i) => (i + 1) % Math.max(1, tips.length))}
        />
      }
    >
      <ThemedText
        themeColor="textSecondary"
        accessibilityLiveRegion="polite"
        style={{ fontSize: 15, lineHeight: 24 }}
      >
        {tip}
      </ThemedText>
    </DashCard>
  );
}

/** Up to three budget missions with their live progress. */
export function MissionsCard({ missions }: { missions: MissionStatus[] }) {
  const theme = useTheme();
  return (
    <DashCard title="Budget missions" padding={20}>
      <View style={{ gap: Space[3] }}>
        {missions.map((mission) => (
          <View
            key={mission.id}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={mission.title}
            accessibilityValue={{ min: 0, max: 100, now: mission.progress }}
            style={{ gap: 6 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space[3] }}>
              <ThemedText
                style={{
                  fontFamily: Fonts.body.semibold,
                  fontSize: 14,
                  lineHeight: 20,
                  flexShrink: 1,
                }}
              >
                {mission.title}
              </ThemedText>
              <Caption bold>{mission.progress}%</Caption>
            </View>
            <Bar percent={mission.progress} color={theme.accent} height={8} />
          </View>
        ))}
      </View>
    </DashCard>
  );
}

/** "Your Money Insights" — plain-language observations from this month's numbers. */
export function InsightsCard({ insights }: { insights: string[] }) {
  const theme = useTheme();
  if (insights.length === 0) return null;
  return (
    <DashCard title="Your Money Insights">
      <View style={{ gap: Space[3] }}>
        {insights.map((text) => (
          <View
            key={text}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Space[2] }}
          >
            <View
              accessibilityElementsHidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.accent,
                marginTop: 8,
              }}
            />
            <ThemedText style={{ flex: 1, fontSize: 15, lineHeight: 23 }}>{text}</ThemedText>
          </View>
        ))}
      </View>
    </DashCard>
  );
}
