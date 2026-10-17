import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScanDropCardProps {
  title: string;
  /** What tapping the box does, e.g. "Tap to scan a receipt photo". */
  prompt: string;
  hint?: string;
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
  /** Small caption under the box — e.g. how many scans are left. */
  footnote?: string | null;
}

/**
 * The design's dashed "tap to scan" box inside a card. The whole box is the
 * button (well over 44px), so it works as a big, forgiving target.
 */
export function ScanDropCard({
  title,
  prompt,
  hint,
  glyph,
  onPress,
  disabled,
  footnote,
}: ScanDropCardProps) {
  const theme = useTheme();

  return (
    <Card style={{ flexGrow: 1, flexBasis: 300, gap: Space[3] }}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={prompt}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: Layout.minimumTouchTarget * 2,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: theme.controlBorder,
          borderRadius: Radius.smallCard,
          paddingVertical: Space[5],
          paddingHorizontal: Space[4],
          alignItems: 'center',
          justifyContent: 'center',
          gap: Space[1],
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          opacity: disabled ? 0.55 : 1,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: Radius.input,
            backgroundColor: theme.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText themeColor="accent" style={{ fontSize: 20 }}>
            {glyph}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
          {prompt}
        </ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {hint}
          </ThemedText>
        ) : null}
      </Pressable>
      {footnote ? (
        <ThemedText type="small" themeColor="textSecondary">
          {footnote}
        </ThemedText>
      ) : null}
    </Card>
  );
}
