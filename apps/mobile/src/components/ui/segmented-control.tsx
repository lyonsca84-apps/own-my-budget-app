import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

/**
 * - `panel`  (default, legacy) gray track, navy selected pill.
 * - `tabs`   white rounded bar with a hairline border, blue selected pill —
 *            the page-level tabs ("Monthly budget | Paycheck budget", the Bills
 *            sub-tabs). Use `PageTabs` for this.
 * - `soft`   gray track, blue selected pill — small in-card toggles
 *            ("Snowball | Avalanche", "All | Deposits | Goals").
 * - `chips`  separate tinted pills, blue when selected — filter rows
 *            ("All accounts, Mortgages, HELOCs…").
 */
export type SegmentedVariant = 'panel' | 'tabs' | 'soft' | 'chips';

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: SegmentedVariant;
  /** `md` (default) is 44px; `sm` is 36px and 14px text, for in-card toggles. */
  size?: 'md' | 'sm';
  /** Names the group for screen readers (e.g. "Budget view"). */
  accessibilityLabel?: string;
  /** Stretch to the parent's width, options sharing it equally. */
  fullWidth?: boolean;
}

/** The pill-group toggle from the handoff's "Selection & toggles" section — e.g. Monthly/Yearly, date-range filters. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'panel',
  size = 'md',
  accessibilityLabel,
  fullWidth,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const isChips = variant === 'chips';
  const isTabs = variant === 'tabs';
  const height = size === 'sm' ? 36 : 44;
  const optionRadius = isTabs ? Radius.input : Radius.full;

  const selectedBg: string = variant === 'panel' ? theme.panel : theme.primary;
  const selectedFg: ThemeColor = variant === 'panel' ? 'onPanel' : 'onPrimary';
  const idleFg: ThemeColor = isChips ? 'solidAccent' : isTabs ? 'text' : 'textSecondary';

  const trackStyle = isChips
    ? { gap: Space[2], flexWrap: 'wrap' as const }
    : isTabs
      ? {
          backgroundColor: theme.backgroundElement,
          borderRadius: Radius.smallCard,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 4,
          gap: 2,
        }
      : {
          backgroundColor: theme.backgroundSelected,
          borderRadius: variant === 'soft' ? Radius.input : Radius.full,
          padding: 4,
          gap: 2,
        };

  const row = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        { flexDirection: 'row', alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        trackStyle,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            style={{
              flexGrow: fullWidth ? 1 : 0,
              flexBasis: fullWidth ? 0 : 'auto',
              paddingVertical: Space[1],
              paddingHorizontal: isTabs ? Space[5] : Space[4],
              borderRadius: optionRadius,
              backgroundColor: selected
                ? selectedBg
                : isChips
                  ? theme.backgroundSelected
                  : 'transparent',
              minHeight: height,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText
              type="smallBold"
              themeColor={selected ? selectedFg : idleFg}
              style={size === 'sm' ? { fontSize: 14, lineHeight: 20 } : undefined}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  // Four-plus long tab labels don't fit a phone: let the bar scroll sideways
  // instead of overflowing the page.
  if (isChips || fullWidth) return row;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      {row}
    </ScrollView>
  );
}

export type PageTabsProps<T extends string> = Omit<SegmentedControlProps<T>, 'variant'>;

/**
 * Page-level tabs: filled blue selected pill inside a white rounded bar.
 * Used for Monthly/Paycheck budget and the Bills / Credit Cards / Loans /
 * Payoff sub-tabs. Same API as `SegmentedControl` minus `variant`.
 */
export function PageTabs<T extends string>(props: PageTabsProps<T>) {
  return <SegmentedControl {...props} variant="tabs" />;
}
