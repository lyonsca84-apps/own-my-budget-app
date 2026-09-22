import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const CARD_PADDING = 24;

/** Poppins semibold card heading — 18px, matching the design's section titles. */
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <ThemedText
      accessibilityRole="header"
      style={{ fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 }}
    >
      {children}
    </ThemedText>
  );
}

export interface DashCardProps {
  title?: string;
  subtitle?: string;
  /** Right-aligned controls in the header row (buttons, links). */
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

/** A white card with the title / trailing-action header every Dashboard section shares. */
export function DashCard({
  title,
  subtitle,
  action,
  children,
  style,
  padding = CARD_PADDING,
}: DashCardProps) {
  return (
    <Card style={[{ padding, gap: Space[4] }, style]}>
      {title || action ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            columnGap: Space[3],
            rowGap: Space[2],
          }}
        >
          <View style={{ flexShrink: 1, gap: 2 }}>
            {title ? <CardTitle>{title}</CardTitle> : null}
            {subtitle ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontSize: 14, lineHeight: 20 }}
              >
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/** Small secondary text (14px) used for captions inside cards. */
export function Caption({
  children,
  color = 'textSecondary',
  bold,
  style,
  ...rest
}: {
  children: ReactNode;
  color?: ThemeColor;
  bold?: boolean;
  style?: object;
} & Record<string, unknown>) {
  return (
    <ThemedText
      type={bold ? 'smallBold' : 'small'}
      themeColor={color}
      style={[{ fontSize: 14, lineHeight: 20 }, style]}
      {...rest}
    >
      {children}
    </ThemedText>
  );
}

/**
 * A compact bordered button used for in-card actions (View Budget, Manage,
 * Next tip…). 44px tall touch target, 12px radius, control border.
 */
export function ChipButton({
  label,
  onPress,
  accessibilityLabel,
  tone = 'outline',
  selected,
  style,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: 'outline' | 'soft' | 'green' | 'panel';
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg =
    tone === 'green'
      ? theme.successMuted
      : tone === 'panel'
        ? theme.panel
        : tone === 'soft'
          ? theme.backgroundSelected
          : 'transparent';
  const fg = tone === 'panel' ? theme.onPanel : tone === 'green' ? theme.success : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: Space[4],
          borderRadius: Radius.input,
          borderWidth: 1.5,
          borderColor:
            tone === 'panel' ? theme.panel : tone === 'green' ? theme.success : theme.controlBorder,
          backgroundColor: bg,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <ThemedText
        style={{ color: fg, fontFamily: Fonts.body.semibold, fontSize: 14, lineHeight: 20 }}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Underlined text link ("View All Bills"). */
export function TextLink({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <ThemedText
        themeColor="primary"
        style={{
          fontFamily: Fonts.body.semibold,
          fontSize: 14,
          lineHeight: 20,
          textDecorationLine: 'underline',
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** A thin horizontal progress track with a filled portion (0–100). */
export function Bar({
  percent,
  color,
  height = 10,
}: {
  percent: number;
  color: string;
  height?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: Radius.full,
        backgroundColor: theme.backgroundSelected,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, percent))}%`,
          borderRadius: Radius.full,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Column that fills half of a wrapping row, and stacks below ~360px of room. */
export const COLUMN_STYLE: ViewStyle = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 340,
  minWidth: 0,
  gap: Space[5],
};
