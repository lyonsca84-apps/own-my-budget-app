import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chevron } from '@/components/ui/chevron';
import { FieldLabel, useFieldChrome } from '@/components/ui/text-field';
import type { SelectFieldProps } from '@/components/ui/select-field-types';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { SelectFieldProps, SelectOption } from '@/components/ui/select-field-types';

/**
 * Native picker: a field that opens a bottom-sheet list of options. (On web
 * `select-field.web.tsx` renders a real, styled `<select>` instead.)
 */
export function SelectField({
  label,
  hideLabel,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  errorMessage,
  disabled,
  compact,
  width,
}: SelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const chrome = useFieldChrome(open, Boolean(errorMessage));
  const selected = options.find((option) => option.value === value);

  return (
    <View style={{ gap: Spacing.two, width }}>
      <FieldLabel label={label} hidden={hideLabel} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selected ? selected.label : placeholder}${errorMessage ? `. ${errorMessage}` : ''}`}
        accessibilityHint="Opens a list of choices"
        aria-disabled={Boolean(disabled)}
        aria-expanded={open}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          chrome,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.two,
            minHeight: compact ? 44 : 52,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <ThemedText
          numberOfLines={1}
          style={{ flexShrink: 1, fontSize: compact ? 15 : 17 }}
          themeColor={selected ? 'text' : 'textSecondary'}
        >
          {selected ? selected.label : placeholder}
        </ThemedText>
        <Chevron color={theme.text} />
      </Pressable>
      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityLabel="Close choices"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,18,40,0.4)',
            }}
          />
          <View
            style={{
              backgroundColor: theme.backgroundElement,
              borderTopLeftRadius: Radius.hero,
              borderTopRightRadius: Radius.hero,
              maxHeight: '70%',
              paddingTop: Spacing.three,
              paddingBottom: Spacing.five,
            }}
          >
            <ThemedText
              type="smallBold"
              style={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.two }}
            >
              {label}
            </ThemedText>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    disabled={option.disabled}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={{
                      minHeight: 48,
                      paddingHorizontal: Spacing.four,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? theme.backgroundSelected : 'transparent',
                      opacity: option.disabled ? 0.5 : 1,
                    }}
                  >
                    <ThemedText themeColor={isSelected ? 'primary' : 'text'}>
                      {option.label}
                    </ThemedText>
                    {isSelected ? <ThemedText themeColor="primary">✓</ThemedText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
