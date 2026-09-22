import { pgError } from './errors';
import { TABLES, primaryKeyOf, type ColumnDef, type TableDef } from './schema';
import { cloneJson, coerceValue, valuesEqual, type Row } from './values';
import { formatDate } from './dates';

/** Who is running a statement. `service` bypasses RLS-style rules, like a service-role key. */
export interface Ctx {
  role: 'authenticated' | 'service';
  userId: string;
}

export function tableDef(name: string): TableDef {
  const def = TABLES[name];
  if (!def) {
    throw pgError(`Could not find the table 'public.${name}' in the schema cache`, 'PGRST205', {
      hint: null,
      status: 404,
    });
  }
  return def;
}

export function columnDef(table: string, column: string): ColumnDef {
  const def = tableDef(table).columns[column];
  if (!def) throw pgError(`column ${table}.${column} does not exist`, '42703');
  return def;
}

type Op = 'select' | 'insert' | 'update' | 'delete';

/**
 * The in-memory tables plus every write rule Postgres would apply:
 * defaults, NOT NULL, CHECK, foreign keys (with ON DELETE), UNIQUE, the
 * `updated_at` trigger, and an approximation of RLS. Writes inside
 * `transaction()` are journaled so a failure part-way rolls all of them back.
 */
export class Database {
  private data = new Map<string, Row[]>();
  private journal: (() => void)[] | null = null;

  constructor(
    readonly clock: () => Date,
    readonly newId: () => string
  ) {
    for (const name of Object.keys(TABLES)) this.data.set(name, []);
  }

  clear() {
    for (const rows of this.data.values()) rows.length = 0;
    this.journal = null;
  }

  /** All rows in a table, ignoring RLS. Mutating the returned rows bypasses every rule. */
  raw(table: string): Row[] {
    tableDef(table);
    return this.data.get(table) as Row[];
  }

  /** Rows the caller may read (`select` policy). */
  visible(table: string, ctx: Ctx): Row[] {
    const def = tableDef(table);
    const rows = this.raw(table);
    if (ctx.role === 'service') return rows;
    if (!def.ops.select) return [];
    if (def.owner === 'public') {
      return table === 'missions' ? rows.filter((r) => r.is_active === true) : rows;
    }
    return rows.filter((r) => r[def.owner] === ctx.userId);
  }

  transaction<T>(fn: () => T): T {
    if (this.journal) return fn();
    this.journal = [];
    try {
      const result = fn();
      this.journal = null;
      return result;
    } catch (error) {
      const journal = this.journal ?? [];
      this.journal = null;
      for (let i = journal.length - 1; i >= 0; i--) journal[i]();
      throw error;
    }
  }

  private undoable(undo: () => void) {
    this.journal?.push(undo);
  }

  private assertAllowed(table: string, op: Op, ctx: Ctx) {
    if (ctx.role === 'service') return;
    const def = tableDef(table);
    if (def.ops[op]) return;
    if (op === 'insert') {
      throw pgError(`new row violates row-level security policy for table "${table}"`, '42501', {
        status: 403,
      });
    }
    // No UPDATE/DELETE policy: PostgREST just sees zero visible rows.
  }

  /** Whether the caller is allowed to touch rows for an update/delete at all. */
  canModify(table: string, op: 'update' | 'delete', ctx: Ctx): boolean {
    return ctx.role === 'service' || tableDef(table).ops[op];
  }

  // --- normalization ------------------------------------------------------

  /** Validates keys/types of a client-supplied object and returns coerced values. */
  normalize(table: string, input: unknown): Row {
    const def = tableDef(table);
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw pgError('Empty or invalid json', 'PGRST102');
    }
    const out: Row = {};
    for (const [key, value] of Object.entries(input as Row)) {
      if (value === undefined) continue;
      const col = def.columns[key];
      if (!col) {
        throw pgError(
          `Could not find the '${key}' column of '${table}' in the schema cache`,
          'PGRST204'
        );
      }
      out[key] = coerceValue(col, value);
    }
    return out;
  }

  private applyDefaults(table: string, values: Row): Row {
    const def = tableDef(table);
    const now = this.clock();
    const row: Row = {};
    for (const [name, col] of Object.entries(def.columns)) {
      if (name in values) {
        row[name] = values[name];
      } else if (col.default === 'uuid') {
        row[name] = this.newId();
      } else if (col.default === 'now') {
        row[name] = now.toISOString();
      } else if (col.default === 'today') {
        row[name] = formatDate(now);
      } else if (col.default) {
        row[name] = cloneJson(col.default.value);
      } else {
        row[name] = null;
      }
    }
    return row;
  }

  // --- constraint checks --------------------------------------------------

  private uniqueKeys(table: string): string[][] {
    return [[primaryKeyOf(table)], ...tableDef(table).unique];
  }

  private validate(table: string, row: Row, ctx: Ctx, self?: Row) {
    const def = tableDef(table);
    for (const [name, col] of Object.entries(def.columns)) {
      const value = row[name];
      if (value === null || value === undefined) {
        if (col.notNull) {
          throw pgError(
            `null value in column "${name}" of relation "${table}" violates not-null constraint`,
            '23502',
            { details: 'Failing row contains the given values.' }
          );
        }
        continue;
      }
      if (col.oneOf && !col.oneOf.includes(value as string)) {
        throw pgError(
          `new row for relation "${table}" violates check constraint "${table}_${name}_check"`,
          '23514'
        );
      }
      if (col.check && !col.check(value)) {
        throw pgError(
          `new row for relation "${table}" violates check constraint "${table}_${name}_check"`,
          '23514'
        );
      }
    }

    if (ctx.role !== 'service' && def.owner !== 'public' && row[def.owner] !== ctx.userId) {
      throw pgError(`new row violates row-level security policy for table "${table}"`, '42501', {
        status: 403,
      });
    }

    for (const [name, col] of Object.entries(def.columns)) {
      const value = row[name];
      if (!col.ref || value === null || value === undefined) continue;
      const parentKey = primaryKeyOf(col.ref.table);
      const exists = this.raw(col.ref.table).some((r) => r[parentKey] === value);
      if (!exists) {
        throw pgError(
          `insert or update on table "${table}" violates foreign key constraint "${table}_${name}_fkey"`,
          '23503',
          {
            details: `Key (${name})=(${String(value)}) is not present in table "${col.ref.table}".`,
          }
        );
      }
    }

    for (const keyCols of this.uniqueKeys(table)) {
      if (keyCols.some((c) => row[c] === null || row[c] === undefined)) continue;
      const clash = this.raw(table).some(
        (other) =>
          other !== self && keyCols.every((c) => valuesEqual(def.columns[c].type, other[c], row[c]))
      );
      if (clash) {
        throw pgError(
          `duplicate key value violates unique constraint "${table}_${keyCols.join('_')}_key"`,
          '23505',
          {
            details: `Key (${keyCols.join(', ')})=(${keyCols.map((c) => String(row[c])).join(', ')}) already exists.`,
            status: 409,
          }
        );
      }
    }
  }

  // --- writes -------------------------------------------------------------

  insertRow(table: string, input: unknown, ctx: Ctx): Row {
    this.assertAllowed(table, 'insert', ctx);
    const row = this.applyDefaults(table, this.normalize(table, input));
    this.validate(table, row, ctx);
    this.raw(table).push(row);
    this.undoable(() => {
      const rows = this.raw(table);
      const index = rows.indexOf(row);
      if (index >= 0) rows.splice(index, 1);
    });
    return row;
  }

  /** Applies a (normalized) patch to one existing row, running the same checks as an UPDATE. */
  updateRow(table: string, row: Row, patch: Row, ctx: Ctx): Row {
    const def = tableDef(table);
    const before = { ...row };
    const next: Row = { ...row, ...patch };
    if ('updated_at' in def.columns) next.updated_at = this.clock().toISOString();
    this.validate(table, next, ctx, row);
    Object.assign(row, next);
    this.undoable(() => {
      for (const key of Object.keys(before)) row[key] = before[key];
    });
    return row;
  }

  deleteRow(table: string, row: Row): void {
    const rows = this.raw(table);
    const index = rows.indexOf(row);
    if (index < 0) return;
    rows.splice(index, 1);
    this.undoable(() => {
      rows.splice(Math.min(index, rows.length), 0, row);
    });

    // ON DELETE CASCADE / SET NULL for everything pointing at this row.
    const key = primaryKeyOf(table);
    for (const [childName, childDef] of Object.entries(TABLES)) {
      for (const [colName, col] of Object.entries(childDef.columns)) {
        if (!col.ref || col.ref.table !== table) continue;
        const children = this.raw(childName).filter((c) => c[colName] === row[key]);
        for (const child of children) {
          if (col.ref.onDelete === 'cascade') {
            this.deleteRow(childName, child);
          } else {
            const before = child[colName];
            child[colName] = null;
            this.undoable(() => {
              child[colName] = before;
            });
          }
        }
      }
    }
  }
}
