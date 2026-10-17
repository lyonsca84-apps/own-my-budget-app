import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, Typography, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'display'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'amount'
    | 'amountSmall'
    | 'eyebrow'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'display' && styles.display,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'amount' && styles.amount,
        type === 'amountSmall' && styles.amountSmall,
        type === 'eyebrow' && styles.eyebrow,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.primary }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Body text never drops below 17px — the accessibility floor the design
// system carries over from PLAN.md. Currency amounts use tabular-nums
// wherever they're set in Poppins so columns of money don't jitter.
const styles = StyleSheet.create({
  small: {
    ...Typography.caption,
  },
  smallBold: {
    ...Typography.caption,
    fontFamily: Fonts.body.semibold,
  },
  default: {
    ...Typography.body,
  },
  title: {
    ...Typography.h1,
  },
  display: {
    ...Typography.display,
  },
  subtitle: {
    ...Typography.h2,
  },
  amount: {
    ...Typography.amount,
  },
  amountSmall: {
    ...Typography.amountSmall,
  },
  eyebrow: {
    ...Typography.eyebrow,
  },
  link: {
    fontFamily: Fonts.body.semibold,
    lineHeight: 28,
    fontSize: 15,
  },
  linkPrimary: {
    fontFamily: Fonts.body.semibold,
    lineHeight: 28,
    fontSize: 15,
  },
  code: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
  },
});
