import { useState } from 'react';
import { formatLocalDate } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  buildExportBundle,
  exportBundleToJson,
  exportLedgerToCsv,
  saveAndShareFile,
} from '@/lib/export-data';

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
    <Screen>
      <SectionCard title="Full data (JSON)">
        <ThemedText themeColor="textSecondary">
          Everything: bills, debts, savings goals, categories, paychecks, and payment history.
        </ThemedText>
        <Button
          label={isExporting === 'json' ? 'Exporting…' : 'Export JSON'}
          onPress={() => handleExport('json')}
          disabled={isExporting !== null}
        />
      </SectionCard>

      <SectionCard title="Spending & savings ledger (CSV)">
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
      </SectionCard>

      {errorMessage ? <ThemedText themeColor="danger">{errorMessage}</ThemedText> : null}
    </Screen>
  );
}
