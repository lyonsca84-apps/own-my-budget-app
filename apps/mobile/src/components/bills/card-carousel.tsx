import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { Chevron } from '@/components/ui/chevron';
import { useTheme } from '@/hooks/use-theme';
import { CreditCardFace } from './credit-card-face';
import { useReducedMotion } from './use-reduced-motion';
import type { DebtItem } from './view-models';

export interface CardCarouselProps {
  cards: DebtItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MAX_CARD_WIDTH = 300;
const MIN_CARD_WIDTH = 220;
const GAP = 36;
const IS_WEB = Platform.OS === 'web';

/**
 * Snap-scrolling card carousel with previous/next buttons, dots and a live
 * "Card 2 of 3" announcement. Works four ways: swipe (touch), the buttons and
 * dots (pointer / switch control), Left/Right arrow keys (keyboard, web), and
 * every card, dot and arrow being its own labeled button (VoiceOver / TalkBack
 * / Tab + Enter). The scroll position and the selected card stay in sync in
 * both directions.
 */
export function CardCarousel({ cards, selectedId, onSelect }: CardCarouselProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const ignoreScrollUntil = useRef(0);
  const [width, setWidth] = useState(0);

  const cardWidth =
    width > 0 ? Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, width * 0.78)) : 260;
  const step = cardWidth + GAP;
  const sidePadding = Math.max(0, (width - cardWidth) / 2);
  const foundIndex = cards.findIndex((c) => c.id === selectedId);
  const selectedIndex = foundIndex < 0 ? 0 : foundIndex;
  const selectedCard = cards[selectedIndex];

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      // Programmatic scrolls fire onScroll for the whole glide; without this
      // guard they'd re-select the card we're passing on the way.
      ignoreScrollUntil.current = Date.now() + (animated ? 650 : 200);
      scrollRef.current?.scrollTo({ x: index * step, animated });
    },
    [step]
  );

  const goTo = useCallback(
    (index: number) => {
      const next = Math.min(cards.length - 1, Math.max(0, index));
      if (!cards[next]) return;
      onSelect(cards[next].id);
      scrollToIndex(next, !reducedMotion);
    },
    [cards, onSelect, reducedMotion, scrollToIndex]
  );

  // Put the scroll position where the selection already is — on first
  // layout, when the card set changes (added/removed), or on resize.
  useEffect(() => {
    if (width > 0 && cards.length > 0) {
      scrollToIndex(selectedIndex, false);
      // The browser re-snaps after a resize and fires scroll events against the new step; ignore that settling.
      ignoreScrollUntil.current = Date.now() + 700;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, cards.length]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (Date.now() < ignoreScrollUntil.current) return;
    const index = Math.min(
      cards.length - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.x / step))
    );
    if (cards[index] && cards[index].id !== selectedId) onSelect(cards[index].id);
  }

  // Web-only extras RN's View types don't declare: arrow-key navigation and
  // CSS scroll snapping (native uses snapToInterval).
  const webGroupProps = IS_WEB
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            goTo(selectedIndex + 1);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            goTo(selectedIndex - 1);
          }
        },
      } as object)
    : {};
  const webScrollStyle = (IS_WEB ? { scrollSnapType: 'x mandatory' } : {}) as ViewStyle;
  const webSnapChildStyle = (IS_WEB ? { scrollSnapAlign: 'center' } : {}) as ViewStyle;

  if (cards.length === 0) return null;

  const announce = `${selectedCard.label}, Card ${selectedIndex + 1} of ${cards.length}`;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      role="group"
      aria-label="Credit cards"
      tabIndex={0}
      {...webGroupProps}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        style={webScrollStyle}
        contentContainerStyle={{
          paddingHorizontal: sidePadding,
          paddingVertical: Space[2],
          gap: GAP,
        }}
      >
        {cards.map((card, index) => {
          const selected = card.id === selectedId || (foundIndex < 0 && index === 0);
          return (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${card.label}, balance ${formatCents(card.balanceCents)}${
                card.utilizationPercent !== null
                  ? `, ${Math.round(card.utilizationPercent)} percent of limit used`
                  : ', credit limit not set'
              }. Card ${index + 1} of ${cards.length}${selected ? ', selected' : ''}`}
              onPress={() => goTo(index)}
              style={[
                {
                  width: cardWidth,
                  borderRadius: Radius.hero,
                  opacity: selected ? 1 : 0.72,
                  transform: [{ scale: selected ? 1 : 0.94 }],
                },
                webSnapChildStyle,
              ]}
            >
              <CreditCardFace
                name={card.label}
                issuer={card.issuer}
                last4={card.last4}
                network={card.network}
                cardStyle={card.cardStyle}
                cardTextMode={card.cardTextMode}
                balanceCents={card.balanceCents}
                utilizationPercent={card.utilizationPercent}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      {cards.length > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Space[3],
            marginTop: Space[3],
          }}
        >
          <NavButton
            label="Previous card"
            disabled={selectedIndex <= 0}
            onPress={() => goTo(selectedIndex - 1)}
            direction="left"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cards.map((card, index) => {
              const selected = index === selectedIndex;
              return (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${card.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => goTo(index)}
                  style={{
                    minHeight: 44,
                    minWidth: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      height: 8,
                      width: selected ? 26 : 8,
                      borderRadius: Radius.full,
                      backgroundColor: selected ? theme.panel : theme.controlBorder,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <NavButton
            label="Next card"
            disabled={selectedIndex >= cards.length - 1}
            onPress={() => goTo(selectedIndex + 1)}
            direction="right"
          />
        </View>
      ) : null}

      <ThemedText
        type="smallBold"
        themeColor="textSecondary"
        accessibilityLiveRegion="polite"
        aria-live="polite"
        style={{ textAlign: 'center', marginTop: Space[2] }}
      >
        {announce}
      </ThemedText>
    </View>
  );
}

/** Round white prev/next control: 44px target around a 36px circle. */
function NavButton({
  label,
  disabled,
  onPress,
  direction,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  direction: 'left' | 'right';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: Radius.full,
          backgroundColor: theme.backgroundElement,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <View style={{ transform: [{ rotate: direction === 'left' ? '90deg' : '-90deg' }] }}>
          <Chevron color={theme.text} />
        </View>
      </View>
    </Pressable>
  );
}
