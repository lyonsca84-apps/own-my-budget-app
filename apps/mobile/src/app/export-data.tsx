import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  buildExportBundle,
  exportBundleToJson,
  exportLedgerToCsv,
  saveAndShareFile,
} from '@/lib/export-data';
import { Spacing } from '@/constants/theme';

export default function ExportDataScreen() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState<'json' | 'csv' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleExport(format: 'json' | 'csv') {
    if (!user) return;
    setErrorMessage(null);
    setIsExporting(format);
    try {
      const bundle = await buildExportBundle(supabase, user.id);
      const dateStamp = formatLocalDate(new Date());
      if (format === 'json') {
        await saveAndShareFile(
          `own-my-budget-export-${dateStamp}.json`,
          exportBundleToJson(bundle),
          'application/json'
        );
      } else {
        await saveAndShareFile(
          `own-my-budget-ledger-${dateStamp}.csv`,
          exportLedgerToCsv(bundle),
          'text/csv'
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong exporting your data.'
      );
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: Spacing.five, gap: Spacing.four }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Export your data
          </ThemedText>

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">Full data (JSON)</ThemedText>
            <ThemedText themeColor="textSecondary">
              Everything: bills, debts, savings goals, categories, paychecks, and payment history.
            </ThemedText>
            <Button
              label={isExporting === 'json' ? 'Exporting…' : 'Export JSON'}
              onPress={() => handleExport('json')}
              disabled={isExporting !== null}
            />
          </Card>

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">Spending &amp; savings ledger (CSV)</ThemedText>
            <ThemedText themeColor="textSecondary">
              Every bill payment, debt payment, and goal deposit/withdrawal, one row each, sorted by
              date.
            </ThemedText>
            <Button
              label={isExporting === 'csv' ? 'Exporting…' : 'Export CSV'}
              variant="secondary"
              onPress={() => handleExport('csv')}
              disabled={isExporting !== null}
            />
          </Card>

          {errorMessage ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage}
            </ThemedText>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
