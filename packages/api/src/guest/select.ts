import { pgError } from './errors';

/** A parsed PostgREST `select=` string. */
export type SelectItem =
  | { kind: 'star' }
  | { kind: 'column'; name: string; alias: string }
  | {
      kind: 'embed';
      /** Embedded table name (or alias target). */
      table: string;
      /** Key the embedded data appears under. */
      alias: string;
      /** `!fk_column` disambiguation hint, when given. */
      hint: string | null;
      inner: boolean;
      items: SelectItem[];
    };

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 0);
}

export function parseSelect(input: string): SelectItem[] {
  const items: SelectItem[] = [];
  for (const part of splitTopLevel(input)) {
    if (part === '*') {
      items.push({ kind: 'star' });
      continue;
    }
    const open = part.indexOf('(');
    if (open >= 0) {
      if (!part.endsWith(')'))
        throw pgError(`failed to parse select parameter (${input})`, 'PGRST100');
      let head = part.slice(0, open).trim();
      const inner = part.slice(open + 1, -1);
      let alias: string | null = null;
      const aliasMatch = /^([^:!]+):(.*)$/.exec(head);
      if (aliasMatch) {
        alias = aliasMatch[1];
        head = aliasMatch[2];
      }
      const [table, ...mods] = head.split('!');
      const isInner = mods.includes('inner');
      const hint = mods.find((m) => m !== 'inner' && m !== 'left') ?? null;
      items.push({
        kind: 'embed',
        table,
        alias: alias ?? table,
        hint,
        inner: isInner,
        items: parseSelect(inner === '' ? '*' : inner),
      });
      continue;
    }
    // "alias:column" and "column::cast" — the cast is irrelevant to in-memory JSON.
    const noCast = part.split('::')[0];
    const aliasMatch = /^([^:]+):(.+)$/.exec(noCast);
    const name = (aliasMatch ? aliasMatch[2] : noCast).trim();
    items.push({ kind: 'column', name, alias: (aliasMatch ? aliasMatch[1] : name).trim() });
  }
  return items;
}
