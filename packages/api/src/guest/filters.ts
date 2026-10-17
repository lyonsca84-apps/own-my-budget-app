import { pgError } from './errors';
import { columnDef } from './db';
import { coerceValue, compareValues, valuesEqual, type Row } from './values';

/**
 * PostgREST-style filters. Each evaluates to true / false / null (SQL's
 * "unknown": any comparison with NULL, and NOT of that) and a row only
 * matches when the whole tree is exactly `true` — same as a WHERE clause.
 */

export type FilterOp =
  'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'cs' | 'cd' | 'ov';

export interface Condition {
  kind: 'cond';
  column: string;
  op: FilterOp;
  value: unknown;
  negate: boolean;
}

export interface Group {
  kind: 'and' | 'or';
  items: FilterNode[];
  negate: boolean;
}

export type FilterNode = Condition | Group;

const OP_ALIASES: Record<string, FilterOp> = {
  eq: 'eq',
  neq: 'neq',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  like: 'like',
  ilike: 'ilike',
  is: 'is',
  in: 'in',
  cs: 'cs',
  cd: 'cd',
  ov: 'ov',
  contains: 'cs',
  containedBy: 'cd',
  overlaps: 'ov',
};

export function toFilterOp(op: string): FilterOp {
  const resolved = OP_ALIASES[op];
  if (!resolved) throw pgError(`unknown filter operator "${op}"`, 'PGRST100');
  return resolved;
}

function likeToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
  let out = '^';
  for (const ch of pattern.replace(/\*/g, '%')) {
    if (ch === '%') out += '[\\s\\S]*';
    else if (ch === '_') out += '[\\s\\S]';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${out}$`, caseInsensitive ? 'i' : '');
}

/** Parses PostgREST list syntax `(a,b,"c d")` into strings. */
function parseList(raw: string): string[] {
  const inner = raw.trim().replace(/^[({]/, '').replace(/[)}]$/, '');
  if (inner === '') return [];
  return inner.split(',').map((part) => part.trim().replace(/^"(.*)"$/, '$1'));
}

function coerceFor(table: string, column: string, value: unknown): unknown {
  // Filter values arrive as strings in URLs — coerce like Postgres would.
  return coerceValue(columnDef(table, column), value === 'null' ? null : value);
}

function isSubset(needle: unknown, haystack: unknown): boolean {
  if (Array.isArray(needle)) {
    return (
      Array.isArray(haystack) &&
      needle.every((n) => haystack.some((h) => JSON.stringify(h) === JSON.stringify(n)))
    );
  }
  if (needle && typeof needle === 'object') {
    if (!haystack || typeof haystack !== 'object') return false;
    return Object.entries(needle as Row).every(([k, v]) => isSubset(v, (haystack as Row)[k]));
  }
  return needle === haystack;
}

function evalCondition(table: string, cond: Condition, row: Row): boolean | null {
  const def = columnDef(table, cond.column);
  const actual = row[cond.column] ?? null;
  const { op } = cond;

  let result: boolean | null;
  if (op === 'is') {
    const target = cond.value;
    if (target === null || target === 'null') result = actual === null;
    else if (target === true || target === 'true') result = actual === true;
    else if (target === false || target === 'false') result = actual === false;
    else throw pgError(`invalid value for "is" filter: ${String(target)}`, 'PGRST100');
    return cond.negate ? !result : result;
  }

  if (op === 'in') {
    const list = (Array.isArray(cond.value) ? cond.value : parseList(String(cond.value))).map((v) =>
      coerceFor(table, cond.column, v)
    );
    if (actual === null) result = null;
    else result = list.some((v) => v !== null && valuesEqual(def.type, actual, v));
    return result === null ? null : cond.negate ? !result : result;
  }

  if (op === 'cs' || op === 'cd' || op === 'ov') {
    if (actual === null) return null;
    const wanted =
      typeof cond.value === 'string' && def.type !== 'jsonb'
        ? parseList(cond.value)
        : typeof cond.value === 'string'
          ? (JSON.parse(cond.value) as unknown)
          : cond.value;
    if (op === 'cs') result = isSubset(wanted, actual);
    else if (op === 'cd') result = isSubset(actual, wanted);
    else {
      result =
        Array.isArray(actual) &&
        Array.isArray(wanted) &&
        actual.some((a) => wanted.some((w) => JSON.stringify(a) === JSON.stringify(w)));
    }
    return cond.negate ? !result : result;
  }

  if (op === 'like' || op === 'ilike') {
    if (actual === null) return null;
    result = likeToRegExp(String(cond.value), op === 'ilike').test(String(actual));
    return cond.negate ? !result : result;
  }

  const expected = coerceFor(table, cond.column, cond.value);
  if (actual === null || expected === null) return null;
  const cmp = compareValues(def.type, actual, expected);
  switch (op) {
    case 'eq':
      result = valuesEqual(def.type, actual, expected);
      break;
    case 'neq':
      result = !valuesEqual(def.type, actual, expected);
      break;
    case 'gt':
      result = cmp > 0;
      break;
    case 'gte':
      result = cmp >= 0;
      break;
    case 'lt':
      result = cmp < 0;
      break;
    default:
      result = cmp <= 0;
  }
  return cond.negate ? !result : result;
}

export function evalFilter(table: string, node: FilterNode, row: Row): boolean | null {
  if (node.kind === 'cond') return evalCondition(table, node, row);
  const results = node.items.map((item) => evalFilter(table, item, row));
  let combined: boolean | null;
  if (node.kind === 'and') {
    combined = results.includes(false) ? false : results.includes(null) ? null : true;
  } else {
    combined = results.includes(true) ? true : results.includes(null) ? null : false;
  }
  return combined === null ? null : node.negate ? !combined : combined;
}

export function matchesAll(table: string, nodes: FilterNode[], row: Row): boolean {
  return nodes.every((node) => evalFilter(table, node, row) === true);
}

/** Checks a filter's column names exist, so typos fail loudly even on an empty table. */
export function validateFilter(table: string, node: FilterNode) {
  if (node.kind !== 'cond') {
    node.items.forEach((item) => validateFilter(table, item));
    return;
  }
  columnDef(table, node.column);
  // Bad values (e.g. a malformed uuid) fail like Postgres does, even on an empty table.
  if (node.op === 'in') {
    const list = Array.isArray(node.value) ? node.value : parseList(String(node.value));
    list.forEach((v) => coerceFor(table, node.column, v));
  } else if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(node.op)) {
    coerceFor(table, node.column, node.value);
  }
}

// --- `or("a.eq.1,b.gt.2,and(c.eq.x,d.is.null)")` string syntax --------------

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim() !== '') parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseLogicalFilter(input: string, kind: 'and' | 'or', negate = false): Group {
  const items: FilterNode[] = [];
  for (const part of splitTopLevel(input)) {
    const nested = /^(not\.)?(and|or)\(([\s\S]*)\)$/.exec(part);
    if (nested) {
      items.push(parseLogicalFilter(nested[3], nested[2] as 'and' | 'or', !!nested[1]));
      continue;
    }
    const match = /^([^.]+)\.(not\.)?([a-zA-Z]+)\.([\s\S]*)$/.exec(part);
    if (!match) throw pgError(`failed to parse logic tree ("${input}")`, 'PGRST100');
    const [, column, not, op, value] = match;
    items.push({
      kind: 'cond',
      column,
      op: toFilterOp(op),
      value: value === 'null' && op === 'is' ? null : value,
      negate: !!not,
    });
  }
  return { kind, items, negate };
}
