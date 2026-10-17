import { formatLocalDate } from '@own-my-budget/core';

import { saveAndShareFile } from '@/lib/export-data';
import type { DebtItem } from './view-models';

/** Spreadsheet apps run cells starting with = + - @ as formulas — prefix them so a card name can't. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export async function exportCardsToCsv(cards: DebtItem[]): Promise<void> {
  const rows: (string | number)[][] = [
    [
      'Name',
      'Issuer',
      'Starting balance',
      'Current balance',
      'Credit limit',
      'APR %',
      'Minimum payment',
      'Total paid',
    ],
    ...cards.map((c) => [
      c.label,
      c.issuer ?? '',
      dollars(c.startingBalanceCents),
      dollars(c.balanceCents),
      c.creditLimitCents !== null ? dollars(c.creditLimitCents) : '',
      (c.aprBasisPoints / 100).toFixed(2),
      dollars(c.minimumPaymentCents),
      dollars(c.totalPaidCents),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  await saveAndShareFile(`credit-cards-${formatLocalDate(new Date())}.csv`, csv, 'text/csv');
}
