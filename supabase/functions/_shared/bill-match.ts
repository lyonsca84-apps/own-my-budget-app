// Hand-maintained Deno-side duplicate of
// packages/ai-orchestrator/src/billMatch.ts — see jev-decisions.ts for why.

export interface KnownBill {
  id: string;
  label: string;
}

export type BillMatchKind = 'exact' | 'fuzzy' | 'none';

export interface BillMatchResult {
  billId: string | null;
  matchKind: BillMatchKind;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function matchBillName(candidate: string, knownBills: KnownBill[]): BillMatchResult {
  const normalizedCandidate = normalize(candidate);
  if (!normalizedCandidate || knownBills.length === 0) {
    return { billId: null, matchKind: 'none' };
  }

  const exact = knownBills.find((bill) => normalize(bill.label) === normalizedCandidate);
  if (exact) return { billId: exact.id, matchKind: 'exact' };

  const contains = knownBills.find((bill) => {
    const normalizedLabel = normalize(bill.label);
    return (
      normalizedLabel.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedLabel)
    );
  });
  if (contains) return { billId: contains.id, matchKind: 'fuzzy' };

  let best: { bill: KnownBill; distance: number } | null = null;
  for (const bill of knownBills) {
    const distance = levenshtein(normalizedCandidate, normalize(bill.label));
    if (!best || distance < best.distance) best = { bill, distance };
  }
  if (best) {
    const threshold = Math.max(
      2,
      Math.floor(Math.max(normalizedCandidate.length, normalize(best.bill.label).length) * 0.3)
    );
    if (best.distance <= threshold) {
      return { billId: best.bill.id, matchKind: 'fuzzy' };
    }
  }

  return { billId: null, matchKind: 'none' };
}
