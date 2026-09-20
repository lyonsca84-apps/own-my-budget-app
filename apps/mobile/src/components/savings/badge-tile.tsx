import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View, type ViewStyle } from 'react-native';
import { BADGE_TIER_LABELS, type BadgeId } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { formatShortDate } from '@/components/savings/format';
import { useReducedMotion } from '@/components/savings/use-reduced-motion';
import type { BadgeView } from '@/components/savings/use-savings-data';
import { Layout, Radius, Space } from '@/constants/theme';
import { BadgeAssets } from '@/design-system/assets/badges';
import { useTheme } from '@/hooks/use-theme';

const ART_SIZE = 88;
// Locked badges are muted: lower opacity plus desaturation, applied on the
// wrapper (expo-image's own style type has no filter). The "Locked" text label
// below carries the state too, so this never relies on the filter alone.
const LOCKED_ART_STYLE: ViewStyle = { opacity: 0.5, filter: [{ grayscale: 0.85 }] };

export interface BadgeTileProps {
  badge: BadgeView;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * One achievement badge: artwork (full color when earned, muted and marked
 * "Locked" otherwise), requirement, and progress toward it. Newly earned
 * badges pop in once — skipped entirely when the OS asks to reduce motion.
 */
export function BadgeTile({ badge, expanded, onToggle }: BadgeTileProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!badge.fresh || reducedMotion !== false) return;
    scale.setValue(0.6);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [badge.fresh, reducedMotion, scale]);

  const showProgress = !badge.earned && !!badge.progress && badge.progress.of > 1;
  const progressPercent = badge.progress ? (badge.progress.now / badge.progress.of) * 100 : 0;
  const stateLabel = badge.earned
    ? badge.earnedOn
      ? `Earned ${formatShortDate(badge.earnedOn)}`
      : 'Earned'
    : showProgress
      ? `Not earned yet, ${badge.progress?.label}`
      : 'Not earned yet';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${badge.name}. ${badge.requirement}. ${stateLabel}`}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 140,
        maxWidth: 240,
        minHeight: Layout.minimumTouchTarget,
        alignItems: 'center',
        gap: Space[1],
        paddingVertical: Space[3],
        paddingHorizontal: Space[2],
        borderRadius: Radius.smallCard,
        backgroundColor: pressed || expanded ? theme.backgroundSelected : 'transparent',
      })}
    >
      <Animated.View style={{ width: ART_SIZE, height: ART_SIZE, transform: [{ scale }] }}>
        <View
          style={[{ width: ART_SIZE, height: ART_SIZE }, badge.earned ? null : LOCKED_ART_STYLE]}
        >
          <Image
            source={BadgeAssets[badge.id as BadgeId]}
            style={{ width: ART_SIZE, height: ART_SIZE }}
            contentFit="contain"
            accessibilityLabel=""
          />
        </View>
        {badge.earned ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 22,
              height: 22,
              borderRadius: Radius.full,
              backgroundColor: theme.successSolid,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText
              type="smallBold"
              style={{ color: theme.onPrimary, fontSize: 12, lineHeight: 16 }}
              accessibilityElementsHidden
            >
              ✓
            </ThemedText>
          </View>
        ) : null}
      </Animated.View>

      <ThemedText
        type="smallBold"
        themeColor={badge.earned ? 'text' : 'textSecondary'}
        style={{ textAlign: 'center', marginTop: Space[2] }}
      >
        {badge.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {badge.requirement}
      </ThemedText>

      {badge.earned ? (
        <ThemedText type="smallBold" themeColor="success" style={{ textAlign: 'center' }}>
          {stateLabel}
        </ThemedText>
      ) : (
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Locked
        </ThemedText>
      )}

      {showProgress ? (
        <View style={{ width: '100%', maxWidth: 120, gap: Space[1] }}>
          <ProgressBar percent={progressPercent} />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {badge.progress?.label}
          </ThemedText>
        </View>
      ) : null}

      {badge.fresh ? (
        <View
          style={{
            backgroundColor: theme.successMuted,
            borderRadius: Radius.chip,
            paddingVertical: Space[1],
            paddingHorizontal: Space[2],
          }}
        >
          <ThemedText type="smallBold" themeColor="success">
            Badge earned!
          </ThemedText>
        </View>
      ) : null}

      {expanded ? (
        <View
          style={{
            alignSelf: 'stretch',
            marginTop: Space[2],
            gap: Space[1],
            padding: Space[3],
            borderRadius: Radius.input,
            backgroundColor: theme.backgroundElement,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <ThemedText type="eyebrow" themeColor="primary">
            {BADGE_TIER_LABELS[badge.tier]} tier
          </ThemedText>
          <ThemedText type="small">{badge.requirement}</ThemedText>
          {showProgress ? (
            <ThemedText type="smallBold" themeColor="textSecondary">
              Progress: {badge.progress?.label}
            </ThemedText>
          ) : null}
          {badge.earned ? (
            <ThemedText type="smallBold" themeColor="success">
              {stateLabel}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
