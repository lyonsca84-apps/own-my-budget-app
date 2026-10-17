import { pgError } from './errors';
import type { ColType, ColumnDef } from './schema';

export type Row = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;

const PG_TYPE_NAME: Record<ColType, string> = {
  uuid: 'uuid',
  text: 'text',
  int: 'integer',
  bigint: 'bigint',
  numeric: 'numeric',
  bool: 'boolean',
  date: 'date',
  timestamptz: 'timestamp with time zone',
  jsonb: 'jsonb',
};

function invalid(type: ColType, value: unknown) {
  const shown = typeof value === 'string' ? value : JSON.stringify(value);
  return pgError(`invalid input syntax for type ${PG_TYPE_NAME[type]}: "${shown}"`, '22P02');
}

export function cloneJson<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Converts a client-supplied value to what Postgres would store for the
 * column's type, or throws the same `22P02` error Postgres would. This is what
 * catches bugs like sending 12.5 (a float) to a bigint `*_cents` column.
 */
export function coerceValue(def: ColumnDef, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const { type } = def;
  switch (type) {
    case 'uuid':
      if (typeof value === 'string' && UUID_RE.test(value)) return value.toLowerCase();
      throw invalid(type, value);
    case 'text':
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      throw invalid(type, value);
    case 'int':
    case 'bigint': {
      const n =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && /^-?\d+$/.test(value.trim())
            ? Number(value)
            : NaN;
      if (!Number.isInteger(n)) throw invalid(type, value);
      if (type === 'int' && (n > 2147483647 || n < -2147483648)) {
        throw pgError('value out of range for type integer', '22003');
      }
      return n;
    }
    case 'numeric': {
      const n =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : NaN;
      if (!Number.isFinite(n)) throw invalid(type, value);
      return n;
    }
    case 'bool':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw invalid(type, value);
    case 'date': {
      if (typeof value !== 'string') throw invalid(type, value);
      const match = DATE_RE.exec(value);
      if (!match) throw invalid(type, value);
      const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const probe = new Date(y, m - 1, d);
      if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
        throw pgError(`date/time field value out of range: "${value}"`, '22008');
      }
      return value.slice(0, 10);
    }
    case 'timestamptz': {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) throw invalid(type, value);
      return date.toISOString();
    }
    case 'jsonb':
      return cloneJson(value);
  }
}

/** Three-way comparison of two non-null values of the column's type. */
export function compareValues(type: ColType, a: unknown, b: unknown): number {
  switch (type) {
    case 'int':
    case 'bigint':
    case 'numeric':
      return (a as number) - (b as number);
    case 'bool':
      return Number(a) - Number(b);
    case 'timestamptz':
      return Date.parse(a as string) - Date.parse(b as string);
    case 'text': {
      const x = a as string;
      const y = b as string;
      const folded = x.toLowerCase().localeCompare(y.toLowerCase(), 'en');
      return folded !== 0 ? folded : x < y ? -1 : x > y ? 1 : 0;
    }
    default: {
      const x = String(a);
      const y = String(b);
      return x < y ? -1 : x > y ? 1 : 0;
    }
  }
}

export function valuesEqual(type: ColType, a: unknown, b: unknown): boolean {
  if (type === 'jsonb') return JSON.stringify(a) === JSON.stringify(b);
  return compareValues(type, a, b) === 0;
}
