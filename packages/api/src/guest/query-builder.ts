import { Database, columnDef, tableDef, type Ctx } from './db';
import { pgError, GuestPostgrestError } from './errors';
import {
  matchesAll,
  parseLogicalFilter,
  toFilterOp,
  validateFilter,
  type Condition,
  type FilterNode,
} from './filters';
import { parseSelect, type SelectItem } from './select';
import { TABLES, primaryKeyOf } from './schema';
import { cloneJson, compareValues, valuesEqual, type Row } from './values';

export interface QueryResponse<T = unknown> {
  data: T | null;
  error: GuestPostgrestError | null;
  count: number | null;
  status: number;
  statusText: string;
}

interface OrderTerm {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

interface EmbedOptions {
  filters: FilterNode[];
  orders: OrderTerm[];
  limit?: number;
  offset?: number;
}

type Operation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

interface Relationship {
  kind: 'many' | 'one';
  /** many: the child table; one: the parent table. */
  table: string;
  /** many: FK column on the child; one: FK column on this row. */
  column: string;
}

function resolveRelationship(parentTable: string, item: Extract<SelectItem, { kind: 'embed' }>) {
  const target = TABLES[item.table];
  if (!target) {
    throw pgError(
      `Could not find a relationship between '${parentTable}' and '${item.table}' in the schema cache`,
      'PGRST200',
      { status: 400 }
    );
  }
  const many = Object.entries(target.columns)
    .filter(([name, col]) => col.ref?.table === parentTable && (!item.hint || item.hint === name))
    .map(([name]): Relationship => ({ kind: 'many', table: item.table, column: name }));
  const one = Object.entries(TABLES[parentTable].columns)
    .filter(([name, col]) => col.ref?.table === item.table && (!item.hint || item.hint === name))
    .map(([name]): Relationship => ({ kind: 'one', table: item.table, column: name }));
  const candidates = [...one, ...many];
  if (candidates.length === 0) {
    throw pgError(
      `Could not find a relationship between '${parentTable}' and '${item.table}' in the schema cache`,
      'PGRST200'
    );
  }
  if (candidates.length > 1) {
    throw pgError(
      `Could not embed because more than one relationship was found for '${parentTable}' and '${item.table}'`,
      'PGRST201',
      { hint: `Use the "!column" hint, e.g. ${item.table}!${candidates[0].column}(...)` }
    );
  }
  return candidates[0];
}

/**
 * The thenable query builder returned by `client.from(table)`. Mirrors the
 * subset of postgrest-js the app uses (and a little more): select with
 * embedded relations, insert / upsert / update / delete, every filter, order,
 * limit / range, count, head, single / maybeSingle. Nothing runs until the
 * builder is awaited, like a real request.
 */
export class QueryBuilder implements PromiseLike<QueryResponse> {
  private op: Operation = 'select';
  private values: unknown = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private returning = false;
  private selectString = '*';
  private countMode: 'exact' | 'planned' | 'estimated' | null = null;
  private head = false;
  private filters: FilterNode[] = [];
  private embedOptions = new Map<string, EmbedOptions>();
  private orders: OrderTerm[] = [];
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private shouldThrow = false;

  constructor(
    private readonly db: Database,
    private readonly ctx: Ctx,
    private readonly table: string,
    private readonly latencyMs: number
  ) {}

  // --- verbs ------------------------------------------------------------

  select(
    columns = '*',
    options: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' } = {}
  ): this {
    if (this.op === 'select') {
      this.head = !!options.head;
    } else {
      this.returning = true;
    }
    this.selectString = columns;
    if (options.count) this.countMode = options.count;
    return this;
  }

  insert(
    values: unknown,
    options: { count?: 'exact' | 'planned' | 'estimated'; defaultToNull?: boolean } = {}
  ): this {
    this.op = 'insert';
    this.values = values;
    if (options.count) this.countMode = options.count;
    return this;
  }

  upsert(
    values: unknown,
    options: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
      count?: 'exact' | 'planned' | 'estimated';
      defaultToNull?: boolean;
    } = {}
  ): this {
    this.op = 'upsert';
    this.values = values;
    this.upsertOptions = options;
    if (options.count) this.countMode = options.count;
    return this;
  }

  update(values: unknown, options: { count?: 'exact' | 'planned' | 'estimated' } = {}): this {
    this.op = 'update';
    this.values = values;
    if (options.count) this.countMode = options.count;
    return this;
  }

  delete(options: { count?: 'exact' | 'planned' | 'estimated' } = {}): this {
    this.op = 'delete';
    if (options.count) this.countMode = options.count;
    return this;
  }

  // --- filters ----------------------------------------------------------

  private addCondition(column: string, op: Condition['op'], value: unknown, negate = false): this {
    const cond: Condition = { kind: 'cond', column, op, value, negate };
    const dot = column.lastIndexOf('.');
    if (dot > 0) {
      // Filter on an embedded resource: `bills.label`.
      const path = column.slice(0, dot);
      this.embedOptionsFor(path).filters.push({ ...cond, column: column.slice(dot + 1) });
    } else {
      this.filters.push(cond);
    }
    return this;
  }

  private embedOptionsFor(path: string): EmbedOptions {
    let existing = this.embedOptions.get(path);
    if (!existing) {
      existing = { filters: [], orders: [] };
      this.embedOptions.set(path, existing);
    }
    return existing;
  }

  eq(column: string, value: unknown) {
    return this.addCondition(column, 'eq', value);
  }
  neq(column: string, value: unknown) {
    return this.addCondition(column, 'neq', value);
  }
  gt(column: string, value: unknown) {
    return this.addCondition(column, 'gt', value);
  }
  gte(column: string, value: unknown) {
    return this.addCondition(column, 'gte', value);
  }
  lt(column: string, value: unknown) {
    return this.addCondition(column, 'lt', value);
  }
  lte(column: string, value: unknown) {
    return this.addCondition(column, 'lte', value);
  }
  like(column: string, pattern: string) {
    return this.addCondition(column, 'like', pattern);
  }
  ilike(column: string, pattern: string) {
    return this.addCondition(column, 'ilike', pattern);
  }
  is(column: string, value: boolean | null) {
    return this.addCondition(column, 'is', value);
  }
  in(column: string, values: readonly unknown[]) {
    return this.addCondition(column, 'in', [...values]);
  }
  contains(column: string, value: unknown) {
    return this.addCondition(column, 'cs', value);
  }
  containedBy(column: string, value: unknown) {
    return this.addCondition(column, 'cd', value);
  }
  overlaps(column: string, value: unknown) {
    return this.addCondition(column, 'ov', value);
  }
  not(column: string, operator: string, value: unknown) {
    return this.addCondition(column, toFilterOp(operator), value, true);
  }
  filter(column: string, operator: string, value: unknown) {
    const negated = operator.startsWith('not.');
    return this.addCondition(
      column,
      toFilterOp(negated ? operator.slice(4) : operator),
      value,
      negated
    );
  }
  match(query: Record<string, unknown>) {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }
  or(filters: string, options: { referencedTable?: string; foreignTable?: string } = {}) {
    const group = parseLogicalFilter(filters, 'or');
    const path = options.referencedTable ?? options.foreignTable;
    if (path) this.embedOptionsFor(path).filters.push(group);
    else this.filters.push(group);
    return this;
  }
  and(filters: string, options: { referencedTable?: string; foreignTable?: string } = {}) {
    const group = parseLogicalFilter(filters, 'and');
    const path = options.referencedTable ?? options.foreignTable;
    if (path) this.embedOptionsFor(path).filters.push(group);
    else this.filters.push(group);
    return this;
  }

  // --- modifiers --------------------------------------------------------

  order(
    column: string,
    options: {
      ascending?: boolean;
      nullsFirst?: boolean;
      referencedTable?: string;
      foreignTable?: string;
    } = {}
  ): this {
    const term: OrderTerm = {
      column,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    };
    const path = options.referencedTable ?? options.foreignTable;
    if (path) this.embedOptionsFor(path).orders.push(term);
    else this.orders.push(term);
    return this;
  }

  limit(count: number, options: { referencedTable?: string; foreignTable?: string } = {}): this {
    const path = options.referencedTable ?? options.foreignTable;
    if (path) this.embedOptionsFor(path).limit = count;
    else this.limitCount = count;
    return this;
  }

  range(
    from: number,
    to: number,
    options: { referencedTable?: string; foreignTable?: string } = {}
  ): this {
    const path = options.referencedTable ?? options.foreignTable;
    if (path) {
      const embed = this.embedOptionsFor(path);
      embed.offset = from;
      embed.limit = to - from + 1;
    } else {
      this.rangeFrom = from;
      this.limitCount = to - from + 1;
    }
    return this;
  }

  single(): this {
    this.mode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.mode = 'maybe';
    return this;
  }

  throwOnError(): this {
    this.shouldThrow = true;
    return this;
  }

  // The remaining postgrest-js modifiers change transport details that don't
  // exist in memory, so they're accepted and ignored.
  abortSignal(): this {
    return this;
  }
  returns(): this {
    return this;
  }
  overrideTypes(): this {
    return this;
  }
  setHeader(): this {
    return this;
  }

  textSearch(): never {
    throw new Error('guest client: textSearch is not supported');
  }
  csv(): never {
    throw new Error('guest client: csv() is not supported');
  }
  explain(): never {
    throw new Error('guest client: explain() is not supported');
  }

  // --- execution --------------------------------------------------------

  then<R1 = QueryResponse, R2 = never>(
    onfulfilled?: ((value: QueryResponse) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private async run(): Promise<QueryResponse> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    else await Promise.resolve();
    let response: QueryResponse;
    try {
      response = this.execute();
    } catch (error) {
      if (!(error instanceof GuestPostgrestError)) throw error;
      response = {
        data: null,
        error,
        count: null,
        status: error.status,
        statusText: 'Bad Request',
      };
    }
    if (this.shouldThrow && response.error) throw response.error;
    return response;
  }

  private execute(): QueryResponse {
    tableDef(this.table);
    for (const node of this.filters) validateFilter(this.table, node);
    for (const term of this.orders) columnDef(this.table, term.column);
    const items = parseSelect(this.selectString);
    this.validateItems(this.table, items);

    switch (this.op) {
      case 'select':
        return this.executeSelect(items);
      case 'insert':
      case 'upsert':
        return this.executeInsert(items);
      case 'update':
        return this.executeUpdate(items);
      default:
        return this.executeDelete(items);
    }
  }

  /** Fails on unknown columns / relationships even when there are no rows to project. */
  private validateItems(table: string, items: SelectItem[]) {
    for (const item of items) {
      if (item.kind === 'column') columnDef(table, item.name);
      else if (item.kind === 'embed') {
        const relation = resolveRelationship(table, item);
        this.validateItems(relation.table, item.items);
      }
    }
  }

  private matching(): Row[] {
    return this.db
      .visible(this.table, this.ctx)
      .filter((r) => matchesAll(this.table, this.filters, r));
  }

  private executeSelect(items: SelectItem[]): QueryResponse {
    const rows = this.matching();
    const pairs: { row: Row; out: Row }[] = [];
    for (const row of rows) {
      const out = this.project(this.table, row, items, '');
      if (out) pairs.push({ row, out });
    }
    this.sort(pairs);
    const count = this.countMode ? pairs.length : null;

    let page = pairs;
    if (this.rangeFrom !== null || this.limitCount !== null) {
      const start = this.rangeFrom ?? 0;
      page = pairs.slice(
        start,
        this.limitCount === null ? undefined : start + Math.max(this.limitCount, 0)
      );
    }
    if (this.head) return this.ok(null, count);
    return this.shape(
      page.map((p) => p.out),
      count,
      200
    );
  }

  private sort(pairs: { row: Row; out: Row }[]) {
    if (this.orders.length === 0) return;
    const compare = rowComparator(this.table, this.orders);
    pairs.sort((a, b) => compare(a.row, b.row));
  }

  private executeInsert(items: SelectItem[]): QueryResponse {
    const inputs = Array.isArray(this.values) ? this.values : [this.values];
    const isUpsert = this.op === 'upsert';
    const written = this.db.transaction(() => {
      const rows =
        isUpsert && inputs.length > 0
          ? this.upsertRows(inputs)
          : inputs.map((input) => this.db.insertRow(this.table, input, this.ctx));
      this.assertSingleCount(rows.length);
      return rows;
    });
    return this.writeResponse(written, items, 201);
  }

  private upsertRows(inputs: unknown[]): Row[] {
    const table = this.table;
    const def = tableDef(table);
    const conflictCols = (this.upsertOptions.onConflict ?? primaryKeyOf(table))
      .split(',')
      .map((c) => c.trim());
    for (const col of conflictCols) columnDef(table, col);
    const matchesConstraint = [[primaryKeyOf(table)], ...def.unique].some(
      (key) => key.length === conflictCols.length && key.every((c) => conflictCols.includes(c))
    );
    if (!matchesConstraint) {
      throw pgError(
        'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        '42P10'
      );
    }

    const touched: Row[] = [];
    const seen = new Set<string>();
    for (const input of inputs) {
      const values = this.db.normalize(table, input);
      const hasKey = conflictCols.every((c) => values[c] !== undefined && values[c] !== null);
      const existing = hasKey
        ? this.db
            .raw(table)
            .find((row) =>
              conflictCols.every((c) => valuesEqual(def.columns[c].type, row[c], values[c]))
            )
        : undefined;

      if (hasKey) {
        const key = conflictCols.map((c) => String(values[c])).join('|');
        if (seen.has(key)) {
          throw pgError('ON CONFLICT DO UPDATE command cannot affect row a second time', '21000', {
            hint: 'Ensure that no rows proposed for insertion within the same command have duplicate constrained values.',
          });
        }
        seen.add(key);
      }
      if (!existing) {
        touched.push(this.db.insertRow(table, values, this.ctx));
        continue;
      }
      if (this.upsertOptions.ignoreDuplicates) continue;
      if (
        !this.db.visible(table, this.ctx).includes(existing) ||
        !this.db.canModify(table, 'update', this.ctx)
      ) {
        throw pgError(`new row violates row-level security policy for table "${table}"`, '42501', {
          status: 403,
        });
      }
      touched.push(this.db.updateRow(table, existing, values, this.ctx));
    }
    return touched;
  }

  private executeUpdate(items: SelectItem[]): QueryResponse {
    if (this.filters.length === 0) {
      throw pgError('UPDATE requires a WHERE clause', '21000');
    }
    const patch = this.db.normalize(this.table, this.values);
    if (Object.keys(patch).length === 0) throw pgError('Empty or invalid json', 'PGRST102');
    const written = this.db.transaction(() => {
      const targets = this.db.canModify(this.table, 'update', this.ctx) ? this.matching() : [];
      const rows = targets.map((row) => this.db.updateRow(this.table, row, patch, this.ctx));
      this.assertSingleCount(rows.length);
      return rows;
    });
    return this.writeResponse(written, items, 200);
  }

  private executeDelete(items: SelectItem[]): QueryResponse {
    if (this.filters.length === 0) {
      throw pgError('DELETE requires a WHERE clause', '21000');
    }
    // Snapshot the rows first so the returned representation is the deleted data.
    const removed = this.db.transaction(() => {
      const targets = this.db.canModify(this.table, 'delete', this.ctx) ? this.matching() : [];
      const snapshots = targets.map((row) => ({ ...row }));
      for (const row of targets) this.db.deleteRow(this.table, row);
      this.assertSingleCount(snapshots.length);
      return snapshots;
    });
    return this.writeResponse(removed, items, 200);
  }

  /** `.single()` on a mutation rolls the whole statement back unless exactly one row was affected. */
  private assertSingleCount(count: number) {
    if (this.mode === 'single' && this.returning && count !== 1) {
      throw this.notSingleError(count);
    }
  }

  private notSingleError(count: number) {
    return pgError('JSON object requested, multiple (or no) rows returned', 'PGRST116', {
      details: `The result contains ${count} rows`,
      status: 406,
    });
  }

  private writeResponse(rows: Row[], items: SelectItem[], status: number): QueryResponse {
    const count = this.countMode ? rows.length : null;
    if (!this.returning) return this.ok(null, count, status === 200 ? 204 : status);
    const projected = rows.map((row) => this.project(this.table, row, items, '')).filter(isRow);
    return this.shape(projected, count, status);
  }

  /** Applies `.single()` / `.maybeSingle()` to a list of result objects. */
  private shape(rows: Row[], count: number | null, status: number): QueryResponse {
    if (this.mode === 'many') return this.ok(rows, count, status);
    if (rows.length === 1) return this.ok(rows[0], count, status);
    if (this.mode === 'maybe' && rows.length === 0) return this.ok(null, count, status);
    throw this.notSingleError(rows.length);
  }

  private ok(data: unknown, count: number | null, status = 200): QueryResponse {
    return { data, error: null, count, status, statusText: 'OK' };
  }

  // --- projection / embedding ------------------------------------------

  private project(table: string, row: Row, items: SelectItem[], path: string): Row | null {
    const def = tableDef(table);
    const out: Row = {};
    for (const item of items) {
      if (item.kind === 'star') {
        for (const name of Object.keys(def.columns)) out[name] = cloneJson(row[name] ?? null);
      } else if (item.kind === 'column') {
        if (!def.columns[item.name]) {
          throw pgError(`column ${table}.${item.name} does not exist`, '42703');
        }
        out[item.alias] = cloneJson(row[item.name] ?? null);
      } else {
        const relation = resolveRelationship(table, item);
        const key = path ? `${path}.${item.alias}` : item.alias;
        const options = this.embedOptions.get(key) ?? this.embedOptions.get(item.table);
        const embedded = this.embed(table, row, relation, item, key, options);
        if (embedded === undefined) return null;
        out[item.alias] = embedded;
      }
    }
    return out;
  }

  /** Returns the embedded value, or `undefined` when an `!inner` embed has no match. */
  private embed(
    parentTable: string,
    row: Row,
    relation: Relationship,
    item: Extract<SelectItem, { kind: 'embed' }>,
    path: string,
    options: EmbedOptions | undefined
  ): Row | Row[] | null | undefined {
    const filters = options?.filters ?? [];
    if (relation.kind === 'one') {
      const fk = row[relation.column];
      const parentKey = primaryKeyOf(relation.table);
      const parent =
        fk === null || fk === undefined
          ? undefined
          : this.db
              .visible(relation.table, this.ctx)
              .find((p) => p[parentKey] === fk && matchesAll(relation.table, filters, p));
      const projected = parent ? this.project(relation.table, parent, item.items, path) : null;
      if (!projected) return item.inner ? undefined : null;
      return projected;
    }

    const parentKey = primaryKeyOf(parentTable);
    let children = this.db
      .visible(relation.table, this.ctx)
      .filter(
        (c) => c[relation.column] === row[parentKey] && matchesAll(relation.table, filters, c)
      );
    if (options?.orders.length) {
      children = [...children].sort(rowComparator(relation.table, options.orders));
    }
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const start = options.offset ?? 0;
      children = children.slice(
        start,
        options.limit === undefined ? undefined : start + options.limit
      );
    }
    const projected = children
      .map((child) => this.project(relation.table, child, item.items, path))
      .filter(isRow);
    if (item.inner && projected.length === 0) return undefined;
    return projected;
  }
}

/** Postgres ordering: NULLs sort as larger than any value unless `nullsFirst` says otherwise. */
function rowComparator(table: string, orders: OrderTerm[]) {
  const def = tableDef(table);
  for (const term of orders) columnDef(table, term.column);
  return (a: Row, b: Row): number => {
    for (const term of orders) {
      const type = def.columns[term.column].type;
      const x = a[term.column] ?? null;
      const y = b[term.column] ?? null;
      if (x === null && y === null) continue;
      const nullsFirst = term.nullsFirst ?? !term.ascending;
      if (x === null) return nullsFirst ? -1 : 1;
      if (y === null) return nullsFirst ? 1 : -1;
      const cmp = compareValues(type, x, y);
      if (cmp !== 0) return term.ascending ? cmp : -cmp;
    }
    return 0;
  };
}

function isRow(value: Row | null): value is Row {
  return value !== null;
}
