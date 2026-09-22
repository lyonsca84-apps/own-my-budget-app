import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  closeDialogRoute,
  DialogError,
  DialogFooter,
  DialogSheet,
  type DialogScreenProps,
} from '@/components/ui/dialog-sheet';
import { Fonts, Layout, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { DialogScreenProps } from '@/components/ui/dialog-sheet';
export { closeDialogRoute } from '@/components/ui/dialog-sheet';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  );
}

/**
 * Focus management for the wide dialog: moves focus in on open, keeps Tab /
 * Shift+Tab inside the card (and pulls stray focus back), closes on Escape,
 * and hands focus back to whatever opened the dialog on unmount.
 */
function useDialogFocus(cardRef: React.RefObject<View | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const card = cardRef.current as unknown as HTMLElement | null;
    if (!card) return;
    const opener = document.activeElement as HTMLElement | null;

    // Prefer the first field in the body over the header controls.
    const first = visibleFocusables(card)[0];
    (first ?? card).focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !card) return;
      const items = visibleFocusables(card);
      if (items.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === firstItem || active === card || !card.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (active === lastItem || !card.contains(active))) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (card && event.target instanceof Node && !card.contains(event.target)) {
        (visibleFocusables(card)[0] ?? card).focus({ preventScroll: true });
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [cardRef]);
}

/**
 * Web: a centered white card over the dimmed previous page (wide screens,
 * >= the sidebar breakpoint); the standard full-height sheet when narrow.
 *
 * Requires the route to be registered with `presentation: 'transparentModal'`
 * (see MODAL_SCREENS in app/_layout.tsx) so the page underneath stays mounted
 * and visible behind the backdrop.
 */
export function DialogScreen(props: DialogScreenProps) {
  const { width } = useWindowDimensions();
  if (width < Layout.sidebarBreakpoint) return <DialogSheet {...props} />;
  return <DialogCard {...props} />;
}

function DialogCard({
  title,
  subtitle,
  onClose = closeDialogRoute,
  size = 'md',
  errorMessage,
  children,
  ...footerProps
}: DialogScreenProps) {
  const theme = useTheme();
  const titleId = useId();
  const cardRef = useRef<View>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(prefersReducedMotion() ? 0 : 10));

  useDialogFocus(cardRef, onClose);

  useEffect(() => {
    // Reduced motion: fade only — no translate.
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.standard,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: Motion.standard,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [opacity, rise]);

  return (
    <Animated.View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Space[5],
        opacity,
      }}
    >
      <Pressable
        accessible={false}
        tabIndex={-1}
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0,18,40,0.42)',
          cursor: 'auto',
        }}
      />
      <Animated.View
        ref={cardRef as unknown as React.Ref<never>}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: size === 'lg' ? 720 : 560,
          maxHeight: '100%',
          backgroundColor: theme.backgroundElement,
          borderRadius: Radius.hero,
          paddingHorizontal: Space[7],
          paddingTop: Space[7],
          paddingBottom: Space[7],
          gap: Space[4],
          boxShadow: '0 30px 60px rgba(0,18,40,0.28)',
          outlineWidth: 0,
          transform: [{ translateY: rise }],
        }}
      >
        <View style={{ gap: Space[1] }}>
          <ThemedText
            nativeID={titleId}
            role="heading"
            aria-level={2}
            style={{ fontFamily: Fonts.heading.bold, fontSize: 22, lineHeight: 30 }}
          >
            {title}
          </ThemedText>
          {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
        </View>
        <ScrollView
          style={{ flexShrink: 1, flexGrow: 0 }}
          contentContainerStyle={{ gap: Space[4], paddingVertical: Space[1] }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        <DialogError message={errorMessage} />
        <DialogFooter {...footerProps} onClose={onClose} />
      </Animated.View>
    </Animated.View>
  );
}
