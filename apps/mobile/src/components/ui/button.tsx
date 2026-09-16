import { Pressable, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: 'primary' | 'panel' | 'secondary' | 'quiet';
}

/** 44pt minimum tap target per PLAN.md's accessibility rules — never make this shorter. */
const MIN_TOUCH_TARGET = Layout.minimumTouchTarget;

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  accessibilityLabel: string;
}

/** Square, bordered icon-only button — same touch target and border treatment as the secondary Button. */
export function IconButton({ children, accessibilityLabel, ...props }: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET,
        minWidth: MIN_TOUCH_TARGET,
        borderRadius: Radius.input,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: theme.controlBorder,
        opacity: props.disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
      {...props}
    >
      {children}
    </Pressable>
  );
}

export function Button({ label, variant = 'primary', ...props }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const isPanel = variant === 'panel';
  const isSecondary = variant === 'secondary';
  const backgroundColor = props.disabled
    ? theme.disabledSurface
    : isPanel
      ? theme.panel
      : isPrimary
        ? theme.primary
        : 'transparent';
  const textColor = props.disabled
    ? theme.disabled
    : isPanel
      ? theme.onPanel
      : isPrimary
        ? theme.onPrimary
        : isSecondary
          ? theme.text
          : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: variant === 'quiet' ? MIN_TOUCH_TARGET : Layout.controlHeight,
        borderRadius: Radius.full,
        paddingHorizontal: isPrimary || isPanel ? 26 : 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        borderWidth: isSecondary ? 1.5 : 0,
        borderColor: isSecondary ? theme.controlBorder : 'transparent',
        opacity: pressed && !props.disabled ? 0.82 : 1,
      })}
      {...props}
    >
      <ThemedText
        type="smallBold"
        style={{ color: textColor, fontFamily: Fonts.body.semibold, fontSize: 17, lineHeight: 24 }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
