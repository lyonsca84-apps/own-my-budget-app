import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { formatMoney } from '@/components/savings/format';
import { Card } from '@/components/ui/card';
import { Chevron } from '@/components/ui/chevron';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface GoalCardProps {
  title: string;
  /** Small line under the title, e.g. "Emergency Fund" or "Block 1 of 11". */
  category?: string;
  /** "Saved / target" for goals, "Saved so far" for the challenge. */
  savedLabel?: string;
  savedCents: number;
  targetCents: number;
  percent: number;
  isComplete: boolean;
  /** When given, shows "$X remaining" under the saved / target line. */
  remainingCents?: number;
  /** A text status (never color alone). */
  status?: { label: string; tone: StatusTone };
  /** Hex ring color — the goal's swatch. Defaults to the teal accent. */
  ringColor?: string | null;
  /** The card's buttons, laid out as one equal-width row: "View Details" then "Add Deposit". */
  actions: ReactNode;
  /** When `onToggleExpanded` is given the chevron discloses `details`. */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  details?: ReactNode;
}

/** The savings-goal card from the approved design: title + category, a small progress ring with a disclosure chevron, saved / target, status and actions. */
export function GoalCard({
  title,
  category,
  savedLabel = 'Saved / target',
  savedCents,
  targetCents,
  percent,
  isComplete,
  remainingCents,
  status,
  ringColor,
  actions,
  expanded,
  onToggleExpanded,
  details,
}: GoalCardProps) {
  const theme = useTheme();

  return (
    <Card style={{ gap: Space[4], minWidth: 0, padding: Space[5] }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: Space[3],
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <ThemedText
            accessibilityRole="header"
            style={{ fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 }}
          >
            {title}
          </ThemedText>
          {category ? (
            <ThemedText type="small" themeColor="textSecondary">
              {category}
            </ThemedText>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
          <GoalRing
            percent={percent}
            color={ringColor ?? theme.accent}
            label={`${title}: ${Math.round(percent)} percent saved`}
          />
          {onToggleExpanded ? (
            <Pressable
              accessibilityRole="button"
              aria-expanded={!!expanded}
              accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details for ${title}`}
              onPress={onToggleExpanded}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: Radius.full,
                borderWidth: 1.5,
                borderColor: theme.controlBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Chevron color={theme.textSecondary} up={!!expanded} size={7} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.border }} />

      <View style={{ gap: Space[1] }}>
        <ThemedText type="eyebrow" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {savedLabel}
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
          <ThemedText type="amountSmall" style={{ fontSize: 24, lineHeight: 30 }}>
            {formatMoney(savedCents)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ fontSize: 16, lineHeight: 22 }}>
            / {formatWhole(targetCents)}
          </ThemedText>
        </View>
        {remainingCents !== undefined ? (
          <ThemedText type="small" themeColor="textSecondary">
            {formatWhole(remainingCents)} remaining
          </ThemedText>
        ) : null}
      </View>

      {status ? (
        <StatusPill label={status.label} tone={status.tone} filled />
      ) : isComplete ? (
        <StatusPill label="Completed" tone="success" filled />
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>{actions}</View>

      {onToggleExpanded && expanded ? <View style={{ gap: Space[3] }}>{details}</View> : null}
    </Card>
  );
}

/** A compact ring carrying the rounded percentage — 56px in the design, so it sits beside the chevron. */
function GoalRing({ percent, color, label }: { percent: number; color: string; label: string }) {
  const theme = useTheme();
  const size = 56;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.backgroundSelected}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>
        <ThemedText
          style={{
            fontFamily: Fonts.body.bold,
            fontSize: 13,
            lineHeight: 16,
            color: theme.text,
          }}
        >
          {Math.round(clamped)}%
        </ThemedText>
      </View>
    </View>
  );
}

/** A card action sized to share its row equally — pass to `actions`. */
export const goalCardActionStyle = { flexGrow: 1, flexBasis: 100, minWidth: 100 } as const;

function formatWhole(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
