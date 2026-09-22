import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { GuestGate } from '@/components/ui/guest-gate';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  buildExportBundle,
  exportBundleToJson,
  exportLedgerToCsv,
  saveAndShareFile,
} from '@/lib/export-data';

export default function ExportDataScreen() {
  const { status, user } = useAuth();
  const [isExporting, setIsExporting] = useState<'json' | 'csv' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleExport(format: 'json' | 'csv') {
    if (!user) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsExporting(format);
    try {
      const bundle = await buildExportBundle(supabase, user.id);
      const dateStamp = formatLocalDate(new Date());
      const filename =
        format === 'json'
          ? `own-my-budget-export-${dateStamp}.json`
          : `own-my-budget-ledger-${dateStamp}.csv`;
      await saveAndShareFile(
        filename,
        format === 'json' ? exportBundleToJson(bundle) : exportLedgerToCsv(bundle),
        format === 'json' ? 'application/json' : 'text/csv'
      );
      setSuccessMessage(`Exported ${filename}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong exporting your data.'
      );
    } finally {
      setIsExporting(null);
    }
  }

  if (status !== 'signedIn') {
    return (
      <GuestGate
        title="Create an account to export your data"
        message="Guest mode shows sample data only. Create a free account and everything you add can be exported any time."
      />
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Export your data' }} />
      <ScreenHeader
        title="Export your data"
        subtitle="Your numbers are yours. Both formats are free on every plan."
      />

      <SectionCard title="Full data (JSON)">
        <View style={{ gap: Space[3] }}>
          <ThemedText themeColor="textSecondary">
            Everything: bills, debts, savings goals, categories, paychecks, and payment history.
          </ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Button
              label={isExporting === 'json' ? 'Exporting…' : 'Export JSON'}
              onPress={() => handleExport('json')}
              disabled={isExporting !== null}
            />
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Spending & savings ledger (CSV)">
        <View style={{ gap: Space[3] }}>
          <ThemedText themeColor="textSecondary">
            Every bill payment, debt payment, and goal deposit/withdrawal, one row each, sorted by
            date.
          </ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Button
              label={isExporting === 'csv' ? 'Exporting…' : 'Export CSV'}
              variant="secondary"
              onPress={() => handleExport('csv')}
              disabled={isExporting !== null}
            />
          </View>
        </View>
      </SectionCard>

      {successMessage ? (
        <ThemedText themeColor="success" accessibilityLiveRegion="polite">
          {successMessage}
        </ThemedText>
      ) : null}
      {errorMessage ? (
        <ThemedText themeColor="warning" accessibilityLiveRegion="polite">
          {errorMessage}
        </ThemedText>
      ) : null}
    </Screen>
  );
}
