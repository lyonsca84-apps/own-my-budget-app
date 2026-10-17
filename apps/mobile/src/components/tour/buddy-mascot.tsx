import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';

import { useReducedMotion } from '@/components/savings/use-reduced-motion';
import { BrandAssets } from '@/design-system/assets/brand';

export type BuddyMood = 'idle' | 'speaking' | 'listening' | 'celebrating';

const useNativeDriver = Platform.OS !== 'web';

/**
 * The approved Budget Buddy artwork with gentle, brief motion per mood:
 * idle floats, speaking gives a short nod, listening tilts toward the
 * question, celebrating does a small hop. Reduced motion (or before the OS
 * has answered) shows the still mascot. The mood is always also said in the
 * speech text beside it, so nothing relies on motion alone.
 */
export function BuddyMascot({ mood, size = 72 }: { mood: BuddyMood; size?: number }) {
  const reduced = useReducedMotion();
  const [lift] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));
  const [tilt] = useState(() => new Animated.Value(0));

  useEffect(() => {
    lift.setValue(0);
    scale.setValue(1);
    tilt.setValue(0);
    if (reduced !== false) return;

    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver,
      });

    let animation: Animated.CompositeAnimation;
    if (mood === 'speaking') {
      const nod = Animated.sequence([timing(scale, 1.05, 180), timing(scale, 1, 180)]);
      animation = Animated.sequence([nod, nod, nod]);
    } else if (mood === 'listening') {
      animation = timing(tilt, 1, 400);
    } else if (mood === 'celebrating') {
      const hop = Animated.sequence([
        Animated.parallel([timing(lift, -12, 220), timing(scale, 1.08, 220)]),
        Animated.parallel([timing(lift, 0, 260), timing(scale, 1, 260)]),
      ]);
      animation = Animated.sequence([hop, hop]);
    } else {
      // Idle: a slow float, stopped after a few cycles so motion stays brief.
      animation = Animated.loop(
        Animated.sequence([timing(lift, -4, 1300), timing(lift, 0, 1300)]),
        { iterations: 3 }
      );
    }
    animation.start();
    return () => animation.stop();
  }, [mood, reduced, lift, scale, tilt]);

  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        transform: [{ translateY: lift }, { scale }, { rotate }],
      }}
    >
      <Image
        source={BrandAssets.mascotTransparent}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </Animated.View>
  );
}
