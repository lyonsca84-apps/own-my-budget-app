import type { ComponentProps, PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
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
import { Fonts, Layout, MaxContentWidth, Spacing } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';
import { useTheme } from '@/hooks/use-theme';

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
const SIDEBAR_BREAKPOINT = 900;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isWide = width >= SIDEBAR_BREAKPOINT;

  return (
    <Tabs style={{ flex: 1, flexDirection: isWide ? 'row' : 'column' }}>
      {/* TabList must be a direct child of Tabs — the navigator statically
          walks its immediate children to register screens, so every
          NAV_ITEMS entry always gets a TabTrigger here regardless of layout;
          NavButton itself decides what's actually visible per layout. */}
      <TabList asChild>
        <NavListChrome isWide={isWide}>
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
        <FloatingHelperButton />
      </View>
    </Tabs>
  );
}

function NavListChrome({ isWide, children }: PropsWithChildren<{ isWide: boolean }>) {
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
            ? { gap: Spacing.half }
            : { flexDirection: 'row', flex: 1, justifyContent: 'space-around' }
        }
      >
        {children}
      </View>

      {isWide && (
        <View style={{ marginTop: 'auto', gap: Spacing.two }}>
          <BudgetBuddyUpsellCard />
          <AccountSummary />
        </View>
      )}
    </View>
  );
}

function AccountSummary() {
  const { status, user, exitGuestMode, signOut } = useAuth();
  const isGuest = status === 'guest';
  const name = isGuest ? 'Guest mode' : (user?.email?.split('@')[0] ?? 'Account');

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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
        padding: Spacing.two,
        borderRadius: Spacing.three,
      }}
    >
      <Avatar name={name} size={28} />
      <View>
        <ThemedText type="smallBold">{name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {actionDescription}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Doubles as the sidebar's persistent entry point to the AI Helper (per the
 * approved design, Helper isn't a standard nav item on either layout). The
 * trial pitch only shows for accounts that aren't already on Budget Buddy. */
function BudgetBuddyUpsellCard() {
  const theme = useTheme();
  const plan = usePlanTier();
  const isBudgetBuddy = plan === 'budgetBuddy';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Budget Buddy, your AI assistant"
      onPress={() => router.push('/helper')}
      style={{
        backgroundColor: theme.budgetBuddy,
        borderRadius: Spacing.four,
        padding: Spacing.three,
        gap: Spacing.one,
      }}
    >
      <ThemedText type="smallBold" themeColor="onPrimary">
        Meet Budget Buddy
      </ThemedText>
      <ThemedText type="small" themeColor="onPrimary" style={{ opacity: 0.9 }}>
        {isBudgetBuddy
          ? 'Your AI assistant for bills, receipts, and getting ahead.'
          : `Try it free for ${PLAN_PRICING.budgetBuddy.trialDays} days — your AI assistant for bills, receipts, and getting ahead.`}
      </ThemedText>
    </Pressable>
  );
}

/** Mobile-only equivalent of the sidebar's Budget Buddy card — a persistent
 * floating button reachable from every tab screen, matching the approved
 * design's floating AI helper affordance. */
function FloatingHelperButton() {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Budget Buddy, your AI assistant"
      onPress={() => router.push('/helper')}
      style={{
        position: 'absolute',
        right: Spacing.four,
        bottom: Spacing.four,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.budgetBuddy,
        alignItems: 'center',
        justifyContent: 'center',
        // Shadow-only emphasis for a floating control — never a border.
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <ThemedText style={{ color: theme.onPrimary, fontSize: 22 }}>✦</ThemedText>
    </Pressable>
  );
}

function ExtraNavLink({ label, href }: { label: string; href: Href }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={{
        borderRadius: Spacing.three,
        paddingVertical: Spacing.two,
        paddingHorizontal: Spacing.three,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: 'transparent' }} />
      <ThemedText type="default" themeColor="text" style={{ fontFamily: Fonts.body.regular }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function NavButton({
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
          borderRadius: Spacing.three,
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
          style={{ fontFamily: isFocused ? Fonts.body.semibold : Fonts.body.regular }}
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
