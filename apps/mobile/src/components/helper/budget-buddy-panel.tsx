import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, CardShadow, Layout, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { BudgetBuddyChat } from './budget-buddy-chat';
import type { BudgetBuddyChat as ChatState } from './use-budget-buddy-chat';

export interface BudgetBuddyPanelProps {
  chat: ChatState;
  onClose: () => void;
}

/**
 * The floating chat panel from the approved design, anchored above the
 * Budget Buddy button on wide layouts. Fades in unless the user prefers
 * reduced motion. Escape closes it on web.
 */
export function BudgetBuddyPanel({ chat, onClose }: BudgetBuddyPanelProps) {
  const theme = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: Motion.quick,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, opacity]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Animated.View
      accessibilityViewIsModal={false}
      accessibilityLabel="Budget Buddy chat"
      style={[
        {
          position: 'absolute',
          right: Space[4],
          bottom: 56 + Space[4] * 2,
          width: 380,
          maxWidth: '100%',
          height: 540,
          maxHeight: '80%',
          zIndex: 41,
          opacity,
          backgroundColor: theme.backgroundElement,
          borderRadius: Radius.card,
          overflow: 'hidden',
        },
        CardShadow,
      ]}
    >
      <LinearGradient
        colors={[Brand.electricity, Brand.sky]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 4 }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: Space[4],
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <View style={{ paddingVertical: Space[3] }}>
          <ThemedText type="smallBold">Budget Buddy</ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ fontSize: 13, lineHeight: 18 }}
          >
            Your AI budget helper
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Budget Buddy"
          onPress={onClose}
          style={{
            minWidth: Layout.minimumTouchTarget,
            minHeight: Layout.minimumTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      </View>
      <BudgetBuddyChat chat={chat} onNavigate={onClose} />
    </Animated.View>
  );
}
