import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Space } from '@/constants/theme';

export interface PageHeaderBackLink {
  /** e.g. "Back to Dashboard" — the arrow is drawn for you. */
  label: string;
  href?: Href;
  /** Use instead of `href` for custom behavior. */
  onPress?: () => void;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** A "← Back to …" text link above the title. */
  backLink?: PageHeaderBackLink;
  /** Right-side controls — year / month `SelectField compact`s, a `+ New Goal` Button. Wraps below the title on narrow screens. */
  right?: ReactNode;
}

/**
 * The one page heading every screen shares: 24px bold title, gray subtitle,
 * optional back link, and a right-aligned slot for controls.
 */
export function PageHeader({ title, subtitle, backLink, right }: PageHeaderProps) {
  return (
    <View style={{ gap: Space[2] }}>
      {backLink ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={backLink.label}
          onPress={() =>
            backLink.onPress ? backLink.onPress() : router.navigate(backLink.href ?? '/')
          }
          hitSlop={8}
          style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
        >
          <ThemedText type="smallBold" themeColor="primary">
            ← {backLink.label}
          </ThemedText>
        </Pressable>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          columnGap: Space[4],
          rowGap: Space[3],
        }}
      >
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: Space[1] }}>
          <ThemedText
            accessibilityRole="header"
            style={{
              fontFamily: Fonts.heading.bold,
              fontSize: 24,
              lineHeight: 32,
              letterSpacing: -0.24,
            }}
          >
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3] }}
          >
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}
