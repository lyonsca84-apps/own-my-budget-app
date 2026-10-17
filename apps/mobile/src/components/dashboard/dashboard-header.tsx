import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { MONTH_NAMES } from '@/components/dashboard/format';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { GreetingHero } from '@/components/ui/greeting-hero';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface DashboardHeaderProps {
  displayName: string;
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

/** Page title plus the greeting hero with the month/year selects and quick-add. */
export function DashboardHeader({
  displayName,
  month,
  year,
  onMonthChange,
  onYearChange,
  onRefresh,
}: DashboardHeaderProps) {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    new Set([currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1, year])
  ).sort();
  const name = displayName || 'there';

  return (
    <View style={{ gap: Space[5] }}>
      <PageHeader title="Dashboard" subtitle="A calm look at where things stand." />
      <GreetingHero
        eyebrow="Dashboard"
        title={`Hello, ${name}`}
        subtitle="Here's a clear look at your money this month."
        action={
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: Space[3],
              maxWidth: '100%',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh dashboard"
              onPress={onRefresh}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: Radius.input,
                borderWidth: 1.5,
                borderColor: theme.controlBorder,
                backgroundColor: theme.backgroundElement,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>⟳</ThemedText>
            </Pressable>
            <SelectField
              label="Select month"
              hideLabel
              compact
              width={148}
              value={String(month)}
              onChange={(value) => onMonthChange(Number(value))}
              options={MONTH_NAMES.map((label, index) => ({ value: String(index), label }))}
            />
            <SelectField
              label="Select year"
              hideLabel
              compact
              width={104}
              value={String(year)}
              onChange={(value) => onYearChange(Number(value))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => router.push('/settings')}
              hitSlop={4}
            >
              <Avatar name={name} size={44} />
            </Pressable>
            <Button
              label="+ Add Transaction"
              variant="panel"
              size="sm"
              shape="rounded"
              onPress={() => router.push('/add-transaction')}
              style={{ minHeight: 44 }}
            />
          </View>
        }
      />
    </View>
  );
}
