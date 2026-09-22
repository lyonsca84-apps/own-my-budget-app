import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { cardForeground, cardIdentity, resolveCardStyle } from './card-style';

export interface CreditCardFaceProps {
  name: string;
  issuer: string | null;
  last4: string | null;
  network: string | null;
  cardStyle: string | null;
  cardTextMode: string | null;
  balanceCents: number;
  utilizationPercent: number | null;
  /** Compact preview (add/edit card form) vs. the full carousel face. */
  compact?: boolean;
}

/**
 * The card art itself. Purely presentational — selection, sizing and the
 * accessible label live on the carousel item that wraps it. Text is drawn in
 * the face's own foreground color (a physical card doesn't follow the app
 * theme), and every fact is text so nothing depends on color alone.
 */
export function CreditCardFace({
  name,
  issuer,
  last4,
  network,
  cardStyle,
  cardTextMode,
  balanceCents,
  utilizationPercent,
  compact,
}: CreditCardFaceProps) {
  const style = resolveCardStyle(cardStyle);
  const fg = cardForeground(cardStyle, cardTextMode);
  const identity = cardIdentity({ issuer, last4, network });
  const gradient =
    style.colors.length === 2 ? style.colors : ([style.colors[0], style.colors[0]] as const);

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: '100%',
        aspectRatio: 1.6,
        borderRadius: Radius.hero,
        padding: compact ? Space[3] : Space[5],
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2], flexShrink: 1 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: Radius.chip,
              backgroundColor: fg === '#FFFFFF' ? 'rgba(255,255,255,0.28)' : 'rgba(0,18,40,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText
              style={{ color: fg, fontFamily: Fonts.body.bold, fontSize: 12, lineHeight: 16 }}
            >
              {identity.badgeInitials || '•'}
            </ThemedText>
          </View>
          <ThemedText
            numberOfLines={1}
            style={{
              color: fg,
              fontFamily: Fonts.body.semibold,
              fontSize: 14,
              lineHeight: 20,
              flexShrink: 1,
            }}
          >
            {identity.bankLabel}
          </ThemedText>
        </View>
        <View
          style={{
            width: 32,
            height: 24,
            borderRadius: 5,
            backgroundColor: fg === '#FFFFFF' ? 'rgba(255,255,255,0.35)' : 'rgba(0,18,40,0.18)',
          }}
        />
      </View>

      <View>
        <ThemedText
          numberOfLines={1}
          style={{ color: fg, fontFamily: Fonts.heading.semibold, fontSize: 16, lineHeight: 22 }}
        >
          {name || 'Your card'}
        </ThemedText>
        <ThemedText
          style={{ color: fg, fontFamily: Fonts.mono.regular, fontSize: 14, letterSpacing: 2 }}
        >
          {identity.maskedNumber}
        </ThemedText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: Space[2],
        }}
      >
        <View>
          <ThemedText
            style={{
              color: fg,
              fontFamily: Fonts.body.semibold,
              fontSize: 12,
              lineHeight: 16,
              letterSpacing: 1.2,
            }}
          >
            BALANCE
          </ThemedText>
          <ThemedText
            style={{
              color: fg,
              fontFamily: Fonts.heading.bold,
              fontSize: 22,
              lineHeight: 28,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCents(balanceCents)}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText
            style={{ color: fg, fontFamily: Fonts.body.semibold, fontSize: 13, lineHeight: 18 }}
          >
            {utilizationPercent !== null
              ? `${Math.round(utilizationPercent)}% used`
              : 'Limit not set'}
          </ThemedText>
          {identity.networkLabel ? (
            <ThemedText
              style={{ color: fg, fontFamily: Fonts.body.regular, fontSize: 13, lineHeight: 18 }}
            >
              {identity.networkLabel}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}
