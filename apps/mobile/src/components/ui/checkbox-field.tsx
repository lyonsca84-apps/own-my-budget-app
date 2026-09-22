import { Platform, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Muted, smaller label — the "Remind" checkbox in bill rows. */
  subtle?: boolean;
}

/** A labelled checkbox with a 44px tap target. Role/state are exposed as a real `checkbox`. */
export function CheckboxField({ label, checked, onChange, disabled, subtle }: CheckboxFieldProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={checked}
      aria-disabled={Boolean(disabled)}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      // react-native-web only turns Enter into a press; a checkbox must also
      // toggle on Space. (onKeyDown is a web-only Pressable prop.)
      {...(Platform.OS === 'web'
        ? {
            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
              if (event.key === ' ' && !disabled) {
                event.preventDefault();
                onChange(!checked);
              }
            },
          }
        : null)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space[2],
        minHeight: Layout.minimumTouchTarget,
        alignSelf: 'flex-start',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? theme.primary : theme.controlBorder,
          backgroundColor: checked ? theme.primary : theme.backgroundElement,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <View
            style={{
              width: 6,
              height: 11,
              marginTop: -2,
              borderRightWidth: 2.5,
              borderBottomWidth: 2.5,
              borderColor: theme.onPrimary,
              borderRadius: Radius.chip / 4,
              transform: [{ rotate: '45deg' }],
            }}
          />
        ) : null}
      </View>
      <ThemedText
        type={subtle ? 'small' : 'default'}
        themeColor={subtle ? 'textSecondary' : 'text'}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
