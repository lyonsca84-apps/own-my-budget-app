import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  entriesToCsv,
  filterEntriesByCategory,
  formatCents,
  monthDateRange,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { AllocationChart } from '@/components/reports/allocation-chart';
import { CategoryBars } from '@/components/reports/category-bars';
import { FilterChips } from '@/components/reports/filter-chips';
import { EntryList } from '@/components/reports/entry-list';
import { getGuestDefaultMonth, useReportData } from '@/components/reports/use-report-data';
import { useReportsGate } from '@/components/reports/use-reports-gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LimitNotice } from '@/components/ui/limit-notice';
import { MONTH_NAMES, MonthStepper } from '@/components/ui/month-stepper';
import { Grid } from '@/components/ui/grid';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatTile } from '@/components/ui/stat-tile';
import { Layout, Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { saveAndShareFile } from '@/lib/export-data';
import { WideSidebarFrame } from '@/components/wide-sidebar-frame';

const MORE_REPORTS: {
  title: string;
  description: string;
  href: '/report-spending' | '/report-income-expenses' | '/report-debt-savings' | '/export-data';
}[] = [
  {
    title: 'Spending over time',
    description: 'Category totals across this month, 3 months, 6 months, or all time.',
    href: '/report-spending',
  },
  {
    title: 'Income vs. expenses',
    description: 'A six-month look at what came in against what went out.',
    href: '/report-income-expenses',
  },
  {
    title: 'Debt & savings progress',
    description: "What you've paid toward debt and saved so far.",
    href: '/report-debt-savings',
  },
  {
    title: 'Export your data',
    description: 'Full JSON or a payment ledger CSV — free on every plan.',
    href: '/export-data',
  },
];

function ReportsScreen() {
  const { status } = useAuth();
  const theme = useTheme();
  const { gate, isLoading: isGateLoading } = useReportsGate();

  const [{ month, year }, setPeriod] = useState(() => {
    if (status === 'guest') return getGuestDefaultMonth();
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const range = monthDateRange(year, month);
  const canView = gate?.allowed === true;
  const data = useReportData(range, canView);

  // A filter that no longer exists in the newly selected month falls back to "all".
  const category =
    selectedCategory &&
    data.categoryTotals.some((t) => t.categoryName.toLowerCase() === selectedCategory.toLowerCase())
      ? selectedCategory
      : null;
  const setCategory = setSelectedCategory;

  const periodLabel = `${MONTH_NAMES[month]} ${year}`;
  const visibleEntries = filterEntriesByCategory(data.entries, category);
  const visibleCategoryTotal = visibleEntries.reduce((sum, e) => sum + e.amountCents, 0);
  const { overview } = data;

  async function handleExport() {
    if (data.isGuest) {
      router.push('/sign-up');
      return;
    }
    setExportMessage(null);
    setIsExporting(true);
    try {
      const filename = `own-my-budget-report-${year}-${String(month + 1).padStart(2, '0')}.csv`;
      await saveAndShareFile(filename, entriesToCsv(visibleEntries), 'text/csv');
      setExportMessage(
        `Exported ${visibleEntries.length} row${visibleEntries.length === 1 ? '' : 's'} to ${filename}.`
      );
    } catch {
      setExportMessage("We couldn't export just now. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Screen showGuestBanner>
      <Stack.Screen options={{ title: 'Reports' }} />
      <ScreenHeader title="Reports" subtitle="Filter by month and category." />

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: Space[3],
        }}
      >
        <MonthStepper month={month} year={year} onChange={setPeriod} />
        {canView ? (
          <Button
            label={
              isExporting ? 'Exporting…' : data.isGuest ? 'Export (needs account)' : 'Export CSV'
            }
            variant="secondary"
            onPress={handleExport}
            disabled={isExporting || (!data.isGuest && !data.hasAnyData)}
            accessibilityLabel={`Export ${category ?? 'all categories'} for ${periodLabel} as CSV`}
          />
        ) : null}
      </View>
      {exportMessage ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {exportMessage}
        </ThemedText>
      ) : null}

      {isGateLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading your reports…</ThemedText>
        </Card>
      ) : !canView ? (
        <LimitNotice
          title="Full reports are on a higher plan"
          reason={
            gate?.reason ??
            "We couldn't check your plan just now. Pull to refresh or try again in a moment."
          }
        />
      ) : data.errorMessage ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText themeColor="warning">{data.errorMessage}</ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Button label="Try again" variant="secondary" onPress={data.refresh} />
          </View>
        </Card>
      ) : data.isLoading ? (
        <Card>
          <ThemedText themeColor="textSecondary">Loading {periodLabel}…</ThemedText>
        </Card>
      ) : !data.hasAnyData ? (
        <EmptyState
          mascot
          title={`Nothing recorded for ${periodLabel} yet`}
          message="Log a paycheck and record a bill or grocery receipt, and this page will fill in with your real numbers."
          action={
            <View style={{ gap: Space[2] }}>
              <Button
                label="Add income"
                variant="panel"
                onPress={() => router.push('/add-income')}
              />
              <Button
                label="Add a bill"
                variant="secondary"
                onPress={() => router.push('/add-bill')}
              />
            </View>
          }
        />
      ) : (
        <>
          <Grid>
            <StatTile
              label="Income"
              valueCents={overview.incomeCents}
              glyph="↗"
              glyphColor="primary"
              glyphTint="primaryMuted"
              description={`Paychecks in ${periodLabel}.`}
            />
            <StatTile
              label="Went out"
              valueCents={overview.outflowCents}
              glyph="≡"
              glyphColor="textSecondary"
              glyphTint="backgroundSelected"
              description="Bills, debt, groceries and savings."
            />
            <StatTile
              label={overview.netCents >= 0 ? 'Left over' : 'Ahead of income'}
              valueCents={Math.abs(overview.netCents)}
              glyph="●"
              glyphColor="accent"
              glyphTint="accentMuted"
              description={
                overview.netCents >= 0
                  ? 'Income minus everything that went out.'
                  : 'Spending ran past income this month — worth a look, nothing more.'
              }
              emphasize
            />
          </Grid>

          <SectionCard title={`Where ${MONTH_NAMES[month]}’s income went`}>
            <AllocationChart
              segments={overview.segments}
              accessibilityTitle={`Where ${periodLabel} income went`}
            />
          </SectionCard>

          <SectionCard
            title={`${category ?? 'Spending by category'} — ${periodLabel}`}
            action={
              category ? (
                <ThemedText type="smallBold">{formatCents(visibleCategoryTotal)}</ThemedText>
              ) : null
            }
          >
            {data.categoryTotals.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                No bill payments, debt payments or grocery receipts in {periodLabel}.
              </ThemedText>
            ) : (
              <View style={{ gap: Space[4] }}>
                <FilterChips
                  accessibilityLabel="Filter by category"
                  allLabel="All categories"
                  options={data.categoryTotals.map((t) => t.categoryName)}
                  value={category}
                  onChange={setCategory}
                />
                <CategoryBars
                  totals={data.categoryTotals}
                  selected={category}
                  onSelect={setCategory}
                />
                {category ? (
                  <View style={{ gap: Space[1] }}>
                    <ThemedText type="smallBold">Payments in {category}</ThemedText>
                    <EntryList entries={visibleEntries} />
                  </View>
                ) : null}
              </View>
            )}
          </SectionCard>
        </>
      )}

      <SectionCard title="More reports">
        <View style={{ gap: Space[1] }}>
          {MORE_REPORTS.map((report) => {
            // Everything but the data export needs the full-reports plan.
            const locked = report.href !== '/export-data' && !canView;
            return (
              <Pressable
                key={report.href}
                accessibilityRole="button"
                accessibilityLabel={report.title}
                accessibilityState={{ disabled: locked }}
                disabled={locked}
                onPress={() => router.push(report.href)}
                style={({ pressed }) => ({
                  minHeight: Layout.minimumTouchTarget,
                  paddingVertical: Space[3],
                  paddingHorizontal: Space[2],
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Space[3],
                  opacity: locked ? 0.5 : 1,
                  backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold">{report.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {report.description}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>
    </Screen>
  );
}

export default function ReportsRoute() {
  return (
    <WideSidebarFrame>
      <ReportsScreen />
    </WideSidebarFrame>
  );
}
