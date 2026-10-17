import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { GuestBanner } from '@/components/ui/guest-banner';
import { useAuth } from '@/contexts/auth-context';
import { BottomTabInset, Layout, Space } from '@/constants/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Renders the persistent "you're exploring in Guest Mode" banner above the scroll area — Home only. */
  showGuestBanner?: boolean;
  /** false for screens that manage their own scrolling (e.g. a chat view). */
  scroll?: boolean;
  /** Vertically centers non-scrolling content — used for guest gates and single-message states. */
  center?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The safe-area + scroll + centered max-width shell every tab screen renders
 * inside. Padding and gap follow the handoff's card padding/gap tokens so a
 * screen's top-level sections line up with the cards inside them.
 */
export function Screen({
  children,
  showGuestBanner,
  scroll = true,
  center = false,
  edges = ['top'],
  contentStyle,
}: ScreenProps) {
  const { status } = useAuth();

  const content = (
    <View
      style={[
        {
          width: '100%',
          maxWidth: Layout.contentMaxWidth,
          alignSelf: 'center',
          padding: Layout.cardPadding,
          gap: Layout.cardGap,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {showGuestBanner && status === 'guest' ? <GuestBanner /> : null}
        {scroll ? (
          <ScrollView contentContainerStyle={{ paddingBottom: BottomTabInset + Space[7] }}>
            {content}
          </ScrollView>
        ) : center ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>{content}</View>
        ) : (
          content
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
