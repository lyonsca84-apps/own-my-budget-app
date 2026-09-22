import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  filterEntriesByCategory,
  formatCents,
  formatLocalDate,
  monthDateRange,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { CategoryBars } from '@/components/reports/category-bars';
import { EntryList } from '@/components/reports/entry-list';
import { FilterChips } from '@/components/reports/filter-chips';
import { useReportData } from '@/components/reports/use-report-data';
import { useReportsGate } from '@/components/reports/use-reports-gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LimitNotice } from '@/components/ui/limit-notice';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

type RangeOption = '1' | '3' | '6' | 'all';
const RANGE_LABELS: Record<RangeOption, string> = {
  '1': 'This month',
  '3': 'Last 3 months',
  '6': 'Last 6 months',
  all: 'All time',
};

function rangeFor(option: RangeOption): { fromDate?: string; toDate?: string } {
  if (option === 'all') return {};
  const now = new Date();
  const monthsBack = Number(option);
  return {
    fromDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)),
    toDate: monthDateRange(now.getFullYear(), now.getMonth()).toDate,
  };
}

export default function ReportSpendingScreen() {
  const { status } = useAuth();
  const { gate, isLoading: isGateLoading } = useReportsGate();
  const [option, setOption] = useState<RangeOption>('3');
  const [category, setCategory] = useState<string | null>(null);

  const canView = gate?.allowed === true;
  // Guests browse the sample data, which sits in past months — an open range shows it all.
  const range = status === 'guest' ? {} : rangeFor(option);
  const data = useReportData(range, canView);

  const spentCents = data.categoryTotals.reduce((sum, t) => sum + t.totalCents, 0);
  const activeCategory =
    category &&
    data.categoryTotals.some((t) => t.categoryName.toLowerCase() === category.toLowerCase())
      ? category
      : null;
  const visibleEntries = filterEntriesByCategory(data.entries, activeCategory);

  return (
    <Screen showGuestBanner>
      <Stack.Screen options={{ title: 'Spending by category' }} />
      <ScreenHeader
        title="Spending by category"
        subtitle="Bill payments, debt payments and grocery receipts, grouped."
      />

      {status !== 'guest' ? (
        <FilterChips
          accessibilityLabel="Time range"
          allLabel={RANGE_LABELS['1']}
          options={[RANGE_LABELS['3'], RANGE_LABELS['6'], RANGE_LABELS.all]}
          value={option === '1' ? null : RANGE_LABELS[option]}
          onChange={(label) => {
            const next = (Object.keys(RANGE_LABELS) as RangeOption[]).find(
              (key) => RANGE_LABELS[key] === label
            );
            setOption(next ?? '1');
          }}
        />
      ) : null}

      {isGateLoading || data.isLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </Card>
      ) : !canView ? (
        <LimitNotice
          title="Full reports are on a higher plan"
          reason={gate?.reason ?? "We couldn't check your plan just now. Please try again."}
        />
      ) : data.errorMessage ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText themeColor="warning">{data.errorMessage}</ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Button label="Try again" variant="secondary" onPress={data.refresh} />
          </View>
        </Card>
      ) : data.categoryTotals.length === 0 ? (
        <EmptyState
          mascot
          title="No spending in this range"
          message="Record a bill payment from the Bills tab or save a grocery receipt to see spending broken down here."
        />
      ) : (
        <>
          <StatTile
            label="Total spending"
            valueCents={spentCents}
            glyph="≡"
            glyphColor="textSecondary"
            glyphTint="backgroundSelected"
            description={`${data.entries.length} payment${data.entries.length === 1 ? '' : 's'} across ${data.categoryTotals.length} categor${data.categoryTotals.length === 1 ? 'y' : 'ies'}.`}
          />
          <SectionCard
            title={activeCategory ?? 'All categories'}
            action={
              activeCategory ? (
                <ThemedText type="smallBold">
                  {formatCents(visibleEntries.reduce((sum, e) => sum + e.amountCents, 0))}
                </ThemedText>
              ) : null
            }
          >
            <View style={{ gap: Space[4] }}>
              <CategoryBars
                totals={data.categoryTotals}
                selected={activeCategory}
                onSelect={setCategory}
              />
              {activeCategory ? <EntryList entries={visibleEntries} /> : null}
            </View>
          </SectionCard>
        </>
      )}
    </Screen>
  );
}
