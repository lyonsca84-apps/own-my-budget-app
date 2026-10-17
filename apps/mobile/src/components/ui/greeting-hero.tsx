import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, SignatureGradient, Space } from '@/constants/theme';

export interface GreetingHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Trailing controls — avatar, date filters, quick-add. */
  action?: ReactNode;
}

/**
 * The dashboard's signature gradient panel. Used once, at the top of one
 * screen (Home) — the handoff is explicit that this treatment never repeats
 * elsewhere and never sits behind a data table.
 */
export function GreetingHero({ eyebrow, title, subtitle, action }: GreetingHeroProps) {
  return (
    <LinearGradient
      colors={SignatureGradient.stops as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.2 }}
      style={{
        borderRadius: Radius.hero,
        padding: Space[7],
        gap: Space[3],
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ gap: Space[1], flexShrink: 1 }}>
        <ThemedText type="eyebrow" style={{ color: '#0052C7' }}>
          {eyebrow}
        </ThemedText>
        <ThemedText type="title" style={{ color: '#001228' }}>
          {title}
        </ThemedText>
        {subtitle ? <ThemedText style={{ color: '#2F4055' }}>{subtitle}</ThemedText> : null}
      </View>
      {action}
    </LinearGradient>
  );
}
