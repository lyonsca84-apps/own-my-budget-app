import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Fonts, Radius, Space, type ThemeColor } from '@/constants/theme';

export interface StatCardProps {
  /** Eyebrow label, e.g. "Monthly savings". */
  label: string;
  /** Pre-formatted value — "$0", "7 Badges". */
  value: string;
  description?: string;
  valueColor?: ThemeColor;
}

/** A design stat card: small caps label, a large figure, and a gray one-line note. */
export function StatCard({ label, value, description, valueColor }: StatCardProps) {
  return (
    <Card
      style={{
        flexGrow: 1,
        flexBasis: 240,
        gap: Space[3],
        borderRadius: Radius.hero,
        padding: Space[7],
        minHeight: 168,
        justifyContent: 'center',
      }}
    >
      <ThemedText type="eyebrow" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {label}
      </ThemedText>
      <ThemedText
        themeColor={valueColor}
        style={{
          fontFamily: Fonts.heading.bold,
          fontSize: 32,
          lineHeight: 40,
          letterSpacing: -0.32,
        }}
      >
        {value}
      </ThemedText>
      {description ? (
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      ) : null}
    </Card>
  );
}
