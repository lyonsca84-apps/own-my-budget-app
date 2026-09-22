import { readFileSync } from 'fs';
import { join } from 'path';

import { TABLES } from '../guest/schema';

/**
 * The in-memory schema is hand-transcribed from the SQL migrations. This keeps
 * it honest against the generated types: same tables, same columns, and every
 * column the generated Insert type marks optional (a default, or nullable) must
 * be optional in the schema too.
 */
const source = readFileSync(join(__dirname, '../database.types.ts'), 'utf8');

function block(table: string, kind: 'Row' | 'Insert'): Record<string, { optional: boolean }> {
  const tableStart = source.indexOf(`\n      ${table}: {\n        Row: {`);
  if (tableStart < 0) throw new Error(`table ${table} not found in database.types.ts`);
  const kindStart = source.indexOf(`        ${kind}: {`, tableStart);
  const end = source.indexOf('\n        };', kindStart);
  const body = source.slice(kindStart, end);
  const columns: Record<string, { optional: boolean }> = {};
  for (const match of body.matchAll(/^ {10}([a-z_0-9]+)(\??):/gm)) {
    columns[match[1]] = { optional: match[2] === '?' };
  }
  return columns;
}

const typeTables = [...source.matchAll(/^ {6}([a-z_]+): \{\n {8}Row: \{/gm)].map((m) => m[1]);

describe('guest schema matches database.types.ts', () => {
  it('has exactly the generated tables', () => {
    expect(Object.keys(TABLES).sort()).toEqual([...typeTables].sort());
  });

  it.each(typeTables)('%s: same columns', (table) => {
    expect(Object.keys(TABLES[table].columns).sort()).toEqual(
      Object.keys(block(table, 'Row')).sort()
    );
  });

  it.each(typeTables)('%s: required-on-insert columns agree', (table) => {
    const insert = block(table, 'Insert');
    for (const [name, col] of Object.entries(TABLES[table].columns)) {
      const hasDefaultOrNullable = !col.notNull || col.default !== undefined;
      expect({ table, name, optional: insert[name].optional }).toEqual({
        table,
        name,
        optional: hasDefaultOrNullable,
      });
    }
  });
});
