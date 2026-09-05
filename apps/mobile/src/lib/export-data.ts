import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  getCurrentAccount,
  listBillsWithPayments,
  listDebtsWithPayments,
  listSavingsGoals,
  listCategories,
  listPaychecks,
  listBillPaymentsForReports,
  listDebtPaymentsForReports,
  listGoalActivityForReports,
  type TypedSupabaseClient,
} from '@own-my-budget/api';

/**
 * PLAN.md screen #61: export "all data" (the full JSON) or a spending/
 * income ledger (the CSV) — one combined file per format rather than a
 * multi-file bundle per data type, which would need a zip step this app
 * doesn't otherwise need.
 */
export async function buildExportBundle(client: TypedSupabaseClient, userId: string) {
  const [
    account,
    bills,
    debts,
    savingsGoals,
    categories,
    paychecks,
    billPayments,
    debtPayments,
    goalActivity,
  ] = await Promise.all([
    getCurrentAccount(client, userId),
    listBillsWithPayments(client, userId),
    listDebtsWithPayments(client, userId),
    listSavingsGoals(client, userId),
    listCategories(client, userId),
    listPaychecks(client, userId),
    listBillPaymentsForReports(client, userId),
    listDebtPaymentsForReports(client, userId),
    listGoalActivityForReports(client, userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: { displayName: account.profile.display_name, currency: account.profile.currency },
    bills,
    debts,
    savingsGoals,
    categories,
    paychecks,
    billPayments,
    debtPayments,
    goalActivity,
  };
}

export type ExportBundle = Awaited<ReturnType<typeof buildExportBundle>>;

export function exportBundleToJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** A single chronological ledger of bill payments, debt payments, and goal deposits/withdrawals. */
export function exportLedgerToCsv(bundle: ExportBundle): string {
  interface Row {
    date: string;
    type: string;
    label: string;
    amountDollars: string;
  }

  const rows: Row[] = [
    ...bundle.billPayments.map((p) => ({
      date: p.paid_on,
      type: 'Bill payment',
      label: p.bill_label,
      amountDollars: (p.amount_cents / 100).toFixed(2),
    })),
    ...bundle.debtPayments.map((p) => ({
      date: p.paid_on,
      type: 'Debt payment',
      label: p.debt_label,
      amountDollars: (p.amount_cents / 100).toFixed(2),
    })),
    ...bundle.goalActivity.map((a) => ({
      date: a.occurred_on,
      type: a.kind === 'withdrawal' ? 'Goal withdrawal' : 'Goal deposit',
      label: a.goal_label,
      amountDollars: (a.amount_cents / 100).toFixed(2),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const header = 'Date,Type,Label,Amount';
  const lines = rows.map(
    (r) =>
      `${csvEscape(r.date)},${csvEscape(r.type)},${csvEscape(r.label)},${csvEscape(r.amountDollars)}`
  );
  return [header, ...lines].join('\n');
}

/**
 * Saves `contents` to a file and opens the platform share/save sheet. On
 * web there's no share sheet — a synthetic download link is the standard,
 * reliable way to hand the browser a file regardless of whether the page
 * is served over https (the Web Share API specifically requires https,
 * plain downloads don't).
 */
export async function saveAndShareFile(
  filename: string,
  contents: string,
  mimeType: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType });
  }
}
