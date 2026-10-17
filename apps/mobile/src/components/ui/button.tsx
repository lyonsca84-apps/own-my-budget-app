import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * - `primary`     filled brand blue (the main action).
 * - `panel`       filled Panel navy (the strongest control; "Manage payments").
 * - `soft`        light-gray fill, dark text (dialog Cancel, "Plan payment", "Edit").
 * - `outline`     transparent with a control border, dark text ("View more").
 * - `secondary`   legacy alias of `outline` — kept so existing call sites don't change look.
 * - `quiet`       text-only link-style button, brand blue.
 * - `danger`      filled clay (rare — a confirmed destructive action).
 * - `dangerOutline` clay text + clay-tinted border ("Delete").
 * - `dangerQuiet` clay text only ("Delete" inline link).
 */
export type ButtonVariant =
  | 'primary'
  | 'panel'
  | 'soft'
  | 'outline'
  | 'secondary'
  | 'quiet'
  | 'danger'
  | 'dangerOutline'
  | 'dangerQuiet';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** `md` (default) is the 52px main-action height; `sm` is a 40px compact button for rows and cards. */
  size?: 'md' | 'sm';
  /** `pill` (default, fully rounded) or `rounded` (12px radius — what dialogs and list-row actions use in the design). */
  shape?: 'pill' | 'rounded';
  /** Shows a spinner in place of the label and disables the button. */
  loading?: boolean;
  /** Layout-only overrides (`flex: 1`, `alignSelf`, margins). Don't restyle colors with this. */
  style?: StyleProp<ViewStyle>;
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

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  loading = false,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled) || loading;
  const isTextOnly = variant === 'quiet' || variant === 'dangerQuiet';

  const filled: Partial<Record<ButtonVariant, { bg: string; fg: string }>> = {
    primary: { bg: theme.primary, fg: theme.onPrimary },
    panel: { bg: theme.panel, fg: theme.onPanel },
    soft: { bg: theme.backgroundSelected, fg: theme.text },
    danger: { bg: theme.solidDanger, fg: theme.onSolid },
  };
  const outlined: Partial<Record<ButtonVariant, { border: string; fg: string }>> = {
    outline: { border: theme.controlBorder, fg: theme.text },
    secondary: { border: theme.controlBorder, fg: theme.text },
    dangerOutline: { border: theme.clay, fg: theme.clay },
  };

  const fill = filled[variant];
  const outline = outlined[variant];
  const textColor = isDisabled
    ? theme.disabled
    : (fill?.fg ?? outline?.fg ?? (variant === 'dangerQuiet' ? theme.clay : theme.primary));
  const backgroundColor = isDisabled
    ? fill
      ? theme.disabledSurface
      : 'transparent'
    : (fill?.bg ?? 'transparent');
  const height = size === 'sm' ? 40 : isTextOnly ? MIN_TOUCH_TARGET : Layout.controlHeight;

  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={isDisabled}
      aria-busy={loading}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 4 : undefined}
      style={({ pressed }) => [
        {
          minHeight: height,
          borderRadius: shape === 'rounded' ? Radius.input : Radius.full,
          paddingHorizontal: size === 'sm' ? 16 : fill && variant !== 'soft' ? 26 : 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          borderWidth: outline ? 1.5 : 0,
          borderColor: outline ? (isDisabled ? theme.border : outline.border) : 'transparent',
          opacity: pressed && !isDisabled ? 0.82 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText
          type="smallBold"
          style={{
            color: textColor,
            fontFamily: Fonts.body.semibold,
            fontSize: size === 'sm' ? 15 : 17,
            lineHeight: size === 'sm' ? 20 : 24,
          }}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}
