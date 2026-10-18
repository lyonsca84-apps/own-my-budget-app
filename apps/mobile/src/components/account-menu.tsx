import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Fonts, Layout, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useProfileImages } from '@/lib/profile-images';

type Anchor = { x: number; y: number; width: number; height: number };

const MENU_WIDTH = 248;

/** Web: move focus to the element with this accessible name (after the menu closes). */
function focusByLabel(label: string) {
  if (Platform.OS !== 'web') return;
  setTimeout(() => document.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.focus(), 0);
}

/**
 * The account control: an avatar (and, in the sidebar, the name with a ⋮)
 * that opens a small menu with Profile, Settings, Subscription & plan and
 * Log out — each routing to the existing screen. Desktop shows a popover
 * anchored to the trigger; narrow screens get a bottom sheet with large rows.
 * Escape or a click outside closes it, and focus returns to the trigger.
 */
export function AccountMenu({
  variant,
  name,
  avatarSize = 32,
}: {
  /** `row`: avatar + name + ⋮ (sidebar). `avatar`: just the avatar (page headers). */
  variant: 'row' | 'avatar';
  name: string;
  avatarSize?: number;
}) {
  const theme = useTheme();
  const { status, signOut, exitGuestMode } = useAuth();
  const { width, height } = useWindowDimensions();
  const isWide = width >= Layout.sidebarBreakpoint;
  const isGuest = status === 'guest';
  const { avatarUrl } = useProfileImages();

  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = anchor !== null;

  const label = `Account menu for ${name}`;
  const close = (restoreFocus = true) => {
    setAnchor(null);
    if (restoreFocus) focusByLabel(label);
  };

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, width: w, height: h }));
  };

  // Web: Escape closes (focus back to the trigger); the first item gets focus on open.
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    setTimeout(
      () => document.querySelector<HTMLElement>('[role="menu"] [role="menuitem"]')?.focus(),
      0
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setAnchor(null);
      focusByLabel(label);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, label]);

  const go = (href: Href) => {
    close(false);
    router.push(href);
  };

  const items: { label: string; onPress: () => void; quiet?: boolean }[] = isGuest
    ? [
        { label: 'Settings', onPress: () => go('/settings') },
        {
          label: 'Create an account',
          onPress: () => {
            close(false);
            exitGuestMode();
          },
        },
      ]
    : [
        { label: 'Profile', onPress: () => go('/settings?section=profile') },
        { label: 'Settings', onPress: () => go('/settings') },
        { label: 'Subscription & plan', onPress: () => go('/subscription') },
        {
          label: 'Log out',
          quiet: true,
          onPress: () => {
            close(false);
            signOut();
          },
        },
      ];

  // Desktop popover: above a sidebar row, below a header avatar; kept on screen.
  let popover: { left: number; top?: number; bottom?: number } | null = null;
  if (anchor && isWide) {
    const preferred = variant === 'row' ? anchor.x : anchor.x + anchor.width - MENU_WIDTH;
    const left = Math.min(Math.max(Space[2], preferred), width - MENU_WIDTH - Space[2]);
    popover =
      variant === 'row'
        ? { left, bottom: Math.max(Space[2], height - anchor.y + Space[2]) }
        : { left, top: anchor.y + anchor.height + Space[2] };
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        aria-haspopup="menu"
        onPress={openMenu}
        hitSlop={4}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          ...(variant === 'row'
            ? {
                flexDirection: 'row',
                alignItems: 'center',
                gap: Space[2],
                minHeight: Layout.minimumTouchTarget,
                paddingVertical: Space[1],
                paddingHorizontal: Space[2],
                borderRadius: Radius.input,
              }
            : { borderRadius: Radius.full }),
        })}
      >
        <Avatar name={name} size={avatarSize} imageUri={avatarUrl} />
        {variant === 'row' ? (
          <>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={{ flex: 1, fontSize: 14, lineHeight: 18 }}
            >
              {name}
            </ThemedText>
            <ThemedText
              themeColor="primary"
              style={{ fontSize: 20, lineHeight: 22, paddingHorizontal: Space[1] }}
            >
              ⋮
            </ThemedText>
          </>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={isWide ? 'none' : 'slide'}
        onRequestClose={() => close()}
      >
        {/* Click or tap outside to close. */}
        <Pressable
          accessibilityLabel="Close account menu"
          onPress={() => close()}
          style={{ flex: 1, backgroundColor: isWide ? 'transparent' : 'rgba(0, 18, 40, 0.35)' }}
        />
        <View
          accessibilityRole="menu"
          aria-label={label}
          style={[
            {
              position: 'absolute',
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              borderWidth: 1.5,
              padding: Space[2],
              gap: 2,
              shadowColor: '#001228',
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            },
            popover
              ? { ...popover, width: MENU_WIDTH, borderRadius: Radius.smallCard }
              : {
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderTopLeftRadius: Radius.card,
                  borderTopRightRadius: Radius.card,
                  paddingBottom: Space[7],
                },
          ]}
        >
          {!popover ? (
            <ThemedText
              type="smallBold"
              themeColor="textSecondary"
              style={{ paddingHorizontal: Space[3], paddingVertical: Space[2] }}
            >
              {name}
            </ThemedText>
          ) : null}
          {items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="menuitem"
              onPress={item.onPress}
              style={({ pressed }) => ({
                minHeight: popover ? Layout.minimumTouchTarget : 52,
                justifyContent: 'center',
                paddingHorizontal: Space[3],
                borderRadius: Radius.input,
                backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
                ...(item.quiet
                  ? { borderTopWidth: 1, borderTopColor: theme.border, marginTop: Space[1] }
                  : {}),
              })}
            >
              <ThemedText
                themeColor={item.quiet ? 'textSecondary' : 'text'}
                style={{ fontFamily: Fonts.body.medium, fontSize: 16 }}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}
