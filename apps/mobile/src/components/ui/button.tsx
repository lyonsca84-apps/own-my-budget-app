import { Pressable, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: 'primary' | 'secondary';
}

/** 44pt minimum tap target per PLAN.md's accessibility rules — never make this shorter. */
const MIN_TOUCH_TARGET = 44;

export function Button({ label, variant = 'primary', ...props }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const textColor: ThemeColor = isPrimary ? 'onPrimary' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET,
        borderRadius: Spacing.three,
        paddingHorizontal: Spacing.four,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isPrimary ? theme.primary : 'transparent',
        borderWidth: isPrimary ? 0 : 1,
        borderColor: theme.primary,
        opacity: pressed ? 0.85 : 1,
      })}
      {...props}
    >
      <ThemedText type="smallBold" themeColor={textColor}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
