import type { ComponentProps, PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { getCurrentAccount } from '@own-my-budget/api';
import { PLAN_PRICING, type PlanTier } from '@own-my-budget/core';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { NAV_ITEMS, WIDE_EXTRA_LINKS } from '@/constants/nav';
import { Brand, Fonts, Layout, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';
import { useTheme } from '@/hooks/use-theme';
import { BudgetBuddyFab } from '@/components/helper/budget-buddy-fab';
import { BudgetBuddyPanel } from '@/components/helper/budget-buddy-panel';
import { useBudgetBuddyChat } from '@/components/helper/use-budget-buddy-chat';

/** Fetches the signed-in user's plan tier — `null` for guests (no real entitlement to check) or while loading. */
function usePlanTier(): PlanTier | null {
  const { status, user } = useAuth();
  const [plan, setPlan] = useState<PlanTier | null>(null);

  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    let isMounted = true;
    getCurrentAccount(supabase, user.id).then((account) => {
      if (isMounted) setPlan(account.entitlement.plan_tier as PlanTier);
    });
    return () => {
      isMounted = false;
    };
  }, [status, user]);

  return plan;
}

/** Below this width, the sidebar collapses into a bottom tab bar (mobile web). */
export const SIDEBAR_BREAKPOINT = Layout.sidebarBreakpoint;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isWide = width >= SIDEBAR_BREAKPOINT;
  // Wide layouts get the design's floating chat panel; narrow ones open the
  // full-screen helper route. The chat state lives here so closing the panel
  // never loses the conversation.
  const chat = useBudgetBuddyChat();
  const { reloadGate } = chat;
  const [helperOpen, setHelperOpen] = useState(false);
  const openHelper = useCallback(() => {
    if (isWide) {
      setHelperOpen(true);
      reloadGate();
    } else {
      router.push('/helper');
    }
  }, [isWide, reloadGate]);
  const closeHelper = useCallback(() => setHelperOpen(false), []);
  const panelOpen = isWide && helperOpen;

  return (
    <Tabs style={{ flex: 1, flexDirection: isWide ? 'row' : 'column' }}>
      {/* TabList must be a direct child of Tabs — the navigator statically
          walks its immediate children to register screens, so every
          NAV_ITEMS entry always gets a TabTrigger here regardless of layout;
          NavButton itself decides what's actually visible per layout. */}
      <TabList asChild>
        <NavListChrome isWide={isWide} onOpenHelper={openHelper}>
          {NAV_ITEMS.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <NavButton
                label={isWide ? item.wideLabel : item.narrowLabel}
                isWide={isWide}
                hidden={isWide && item.hideOnWide}
              />
            </TabTrigger>
          ))}
          {isWide &&
            WIDE_EXTRA_LINKS.map((link) => (
              <ExtraNavLink key={link.href as string} label={link.label} href={link.href} />
            ))}
        </NavListChrome>
      </TabList>
      <View style={{ flex: 1, minHeight: 0 }}>
        <TabSlot style={{ flex: 1 }} />
        {panelOpen ? <BudgetBuddyPanel chat={chat} onClose={closeHelper} /> : null}
        <BudgetBuddyFab
          expanded={isWide ? panelOpen : undefined}
          onPress={panelOpen ? closeHelper : openHelper}
        />
      </View>
    </Tabs>
  );
}

export function NavListChrome({
  isWide,
  onOpenHelper,
  children,
}: PropsWithChildren<{ isWide: boolean; onOpenHelper: () => void }>) {
  const theme = useTheme();

  return (
    <View
      style={
        isWide
          ? {
              width: Layout.sidebarWidth,
              flexShrink: 0,
              backgroundColor: theme.backgroundElement,
              borderRightWidth: 1,
              borderRightColor: theme.border,
              paddingVertical: Spacing.four,
              paddingHorizontal: Spacing.three,
              gap: Spacing.five,
            }
          : ({
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: theme.border,
              backgroundColor: theme.backgroundElement,
              paddingVertical: Spacing.two,
              paddingHorizontal: Spacing.one,
              justifyContent: 'space-around',
              maxWidth: MaxContentWidth,
              width: '100%',
              alignSelf: 'center',
              // `order` is a valid CSS property react-native-web passes through
              // (this file only ever runs on web), but it's missing from RN's
              // own ViewStyle type — hence the cast.
              order: 2,
            } as ViewStyle)
      }
    >
      {isWide && (
        <View style={{ alignItems: 'flex-start', paddingHorizontal: Spacing.two }}>
          <Image
            source={BrandAssets.horizontalLockup}
            contentFit="contain"
            style={{ width: 190, height: 88 }}
            accessibilityLabel="Own My Budget"
          />
        </View>
      )}

      <View
        style={
          isWide
            ? { gap: Spacing.one }
            : { flexDirection: 'row', flex: 1, justifyContent: 'space-around' }
        }
      >
        {children}
      </View>

      {isWide && (
        <View style={{ marginTop: 'auto', gap: Spacing.two }}>
          <BudgetBuddyUpsellCard onOpen={onOpenHelper} />
          <AccountSummary />
        </View>
      )}
    </View>
  );
}

function AccountSummary() {
  const theme = useTheme();
  const { status, user, exitGuestMode, signOut } = useAuth();
  const isGuest = status === 'guest';
  const name = isGuest ? 'Guest Mode' : (user?.email?.split('@')[0] ?? 'Account');

  const actionDescription = isGuest ? 'Demo data — tap to create an account' : 'Tap to log out';

  return (
    <Pressable
      onPress={() => {
        // RootNavigator's Stack.Protected guard swaps to (auth) automatically
        // once status changes — no manual navigation needed here.
        if (isGuest) {
          exitGuestMode();
        } else {
          signOut();
        }
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${actionDescription}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        padding: Spacing.two,
        borderRadius: Radius.input,
        backgroundColor: theme.background,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {isGuest ? (
        // Soft teal-to-green orb, per the design's guest block.
        <LinearGradient
          colors={[`${Brand.electricity}66`, `${Brand.ecology}80`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
        />
      ) : (
        <Avatar name={name} size={32} />
      )}
      <View style={{ flexShrink: 1 }}>
        <ThemedText type="smallBold" style={{ fontSize: 14, lineHeight: 18 }}>
          {name}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={{ fontSize: 13, lineHeight: 17 }}
          numberOfLines={1}
        >
          {isGuest ? 'Demo data' : 'Log out'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Doubles as the sidebar's persistent entry point to the AI Helper (per the
 * approved design, Helper isn't a standard nav item on either layout). The
 * trial pitch only shows for accounts that aren't already on Budget Buddy. */
function BudgetBuddyUpsellCard({ onOpen }: { onOpen: () => void }) {
  const theme = useTheme();
  const plan = usePlanTier();
  const isBudgetBuddy = plan === 'budgetBuddy';

  return (
    // Teal-to-blue gradient card per the design, kept at the darker Solid
    // stops so the white copy holds AA contrast.
    <LinearGradient
      colors={[theme.solidAccent, theme.solidInfo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: Radius.smallCard + 2,
        padding: Spacing.three,
        gap: Spacing.one,
      }}
    >
      <ThemedText type="smallBold" style={{ color: theme.onSolid, fontSize: 14, lineHeight: 20 }}>
        Meet Budget Buddy
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.onSolid, fontSize: 13, lineHeight: 18 }}>
        {isBudgetBuddy
          ? 'Your AI assistant for bills, receipts, and getting ahead.'
          : `Try it free for ${PLAN_PRICING.budgetBuddy.trialDays} days — your AI assistant for bills, receipts, and getting ahead.`}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Budget Buddy, your AI assistant"
        onPress={onOpen}
        style={({ pressed }) => ({
          marginTop: Spacing.two,
          minHeight: 40,
          borderRadius: Radius.chip + 2,
          backgroundColor: theme.backgroundElement,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <ThemedText type="smallBold" themeColor="primary">
          {isBudgetBuddy ? 'Open Budget Buddy' : 'Try Budget Buddy'}
        </ThemedText>
      </Pressable>
    </LinearGradient>
  );
}

function ExtraNavLink({ label, href }: { label: string; href: Href }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={{
        borderRadius: Radius.input,
        paddingVertical: Spacing.two,
        paddingHorizontal: Spacing.three,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: 'transparent' }} />
      <ThemedText
        type="default"
        themeColor="text"
        style={{ fontFamily: Fonts.body.medium, fontSize: 16, lineHeight: 22 }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function NavButton({
  label,
  isWide,
  isFocused,
  hidden,
  ...props
}: {
  label: string;
  isWide: boolean;
  hidden?: boolean;
} & Omit<TabTriggerSlotProps, 'children'>) {
  const theme = useTheme();

  if (hidden) return null;

  if (isWide) {
    return (
      <Pressable
        {...(props as ComponentProps<typeof Pressable>)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}
        style={{
          borderRadius: Radius.input,
          paddingVertical: Spacing.two,
          paddingHorizontal: Spacing.three,
          backgroundColor: isFocused ? theme.backgroundSelected : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.two,
        }}
      >
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: isFocused ? theme.primary : 'transparent',
          }}
        />
        <ThemedText
          type="default"
          themeColor={isFocused ? 'primary' : 'text'}
          style={{
            fontFamily: isFocused ? Fonts.body.semibold : Fonts.body.medium,
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...(props as ComponentProps<typeof Pressable>)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      style={{
        alignItems: 'center',
        gap: 2,
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.two,
        minHeight: 44,
        justifyContent: 'center',
      }}
    >
      <ThemedView
        type={isFocused ? 'primary' : 'background'}
        style={{ width: 6, height: 6, borderRadius: 3, marginBottom: 2 }}
      />
      <ThemedText
        type="small"
        themeColor={isFocused ? 'primary' : 'textSecondary'}
        style={{
          fontFamily: isFocused ? Fonts.body.semibold : Fonts.body.medium,
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
