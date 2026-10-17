import type { TypedSupabaseClient } from '../client';
import { Database, type Ctx } from './db';
import { QueryBuilder } from './query-builder';
import { RpcBuilder } from './rpc';
import { GUEST_USER_ID, seedGuestData, type SeedIds } from './seed';
import type { Row } from './values';
import { cloneJson } from './values';

export { GUEST_USER_ID };

/** What a stubbed Edge Function returns: either a body or a friendly error. */
export type GuestFunctionResult =
  | { data: unknown; error?: undefined }
  | { error: { message: string; code?: string }; data?: undefined };

export type GuestFunctionHandler = (
  body: unknown
) => GuestFunctionResult | Promise<GuestFunctionResult>;

export interface GuestClientOptions {
  /** The fake signed-in user's id. Defaults to {@link GUEST_USER_ID}. */
  userId?: string;
  /** Clock used for defaults (`created_at`, `current_date`) and for seeding. Defaults to the real time. */
  now?: () => Date;
  /** Load the demo dataset (default true). Pass false for an empty database in tests. */
  seed?: boolean;
  /** Artificial delay per request, to exercise loading states. Default 0. */
  latencyMs?: number;
  /** Fake Edge Functions by name. Anything not listed returns a friendly "needs a free account" error. */
  functions?: Record<string, GuestFunctionHandler>;
}

export interface GuestControls {
  userId: string;
  /** Ids of the seeded rows, by role (bills.rent, goals.emergency, ...). Empty ids when seed:false. */
  seedIds: SeedIds | null;
  /** Wipes everything and re-seeds from the current clock. */
  reset(): void;
  /** A copy of every row in a table (ignores RLS) — for tests and debugging. */
  rows(table: string): Row[];
  /** Register (or with null remove) a fake Edge Function. */
  setFunctionHandler(name: string, handler: GuestFunctionHandler | null): void;
  /** A client acting as the service role: bypasses RLS-style limits and may call service-only RPCs. */
  service: TypedSupabaseClient;
}

export type GuestClient = TypedSupabaseClient & { guest: GuestControls };

const FRIENDLY: Record<string, string> = {
  'receipt-scan': 'Scanning receipts needs a free account. Create one to try it.',
  'pantry-scan': 'Scanning your pantry needs a free account. Create one to try it.',
  'budget-buddy-chat': 'Budget Buddy needs a free account. Create one to chat.',
  'stripe-checkout': 'Subscriptions need a free account. Create one to upgrade.',
  'stripe-portal': 'Subscriptions need a free account. Create one to manage billing.',
  'delete-account': 'There is no account to delete in guest mode.',
};
const DEFAULT_FRIENDLY = 'This needs a free account. Create one to use it.';

/** A FunctionsHttpError look-alike, so invokeEdgeFunction() unwraps it into an EdgeFunctionError. */
function functionsError(message: string, code: string) {
  const error = new Error(message) as Error & {
    context: { status: number; json: () => Promise<unknown> };
  };
  error.name = 'FunctionsHttpError';
  error.context = { status: 403, json: async () => ({ error: message, code }) };
  return error;
}

function authError(message: string) {
  return Object.assign(new Error(message), { name: 'AuthApiError', status: 400 });
}

function makeUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * An in-memory, Supabase-compatible client for guest mode and tests. It runs
 * the app's real query functions against a seeded fake household, enforcing
 * the same constraints as Postgres (see ./schema.ts), so a guest exercises
 * exactly the code paths a signed-in user does — writes included. Data lives
 * only in memory: `guest.reset()` (or a page reload) restores the seed.
 *
 * Not supported (throws a clear error, or is ignored — see each builder):
 * realtime channels, full-text search, CSV output, `explain`, computed
 * columns / aggregates in `select`, JSON path operators (`col->key`).
 */
export function createGuestClient(options: GuestClientOptions = {}): GuestClient {
  const userId = options.userId ?? GUEST_USER_ID;
  const now = options.now ?? (() => new Date());
  const latencyMs = options.latencyMs ?? 0;
  const db = new Database(now, makeUuid);
  const handlers = new Map<string, GuestFunctionHandler>(Object.entries(options.functions ?? {}));
  const storageObjects = new Map<string, unknown>();
  let seedIds: SeedIds | null = null;

  const load = () => {
    db.clear();
    seedIds = options.seed === false ? null : seedGuestData(db, { userId, now: now() });
    controls.seedIds = seedIds;
  };

  const buildClient = (ctx: Ctx) => {
    const session = {
      access_token: 'guest-access-token',
      refresh_token: 'guest-refresh-token',
      token_type: 'bearer',
      expires_in: 60 * 60 * 24 * 365,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'guest@ownmybudget.demo',
        app_metadata: {},
        user_metadata: { guest: true },
        created_at: new Date(0).toISOString(),
      },
    };
    const needsAccount = async () => ({
      data: { user: null, session: null },
      error: authError('This needs a free account. Create one to continue.'),
    });

    const client = {
      from: (table: string) => new QueryBuilder(db, ctx, table, latencyMs),
      schema: () => client,
      rpc: (name: string, args: Record<string, unknown> = {}) =>
        new RpcBuilder(db, ctx, name, args, latencyMs),

      functions: {
        async invoke(name: string, invokeOptions: { body?: unknown } = {}) {
          const handler = handlers.get(name);
          if (handler) {
            const result = await handler(invokeOptions.body);
            if (result.error) {
              return {
                data: null,
                error: functionsError(result.error.message, result.error.code ?? 'guest_mode'),
              };
            }
            return { data: cloneJson(result.data), error: null };
          }
          return {
            data: null,
            error: functionsError(FRIENDLY[name] ?? DEFAULT_FRIENDLY, 'guest_mode'),
          };
        },
      },

      storage: {
        from: (bucket: string) => ({
          async upload(path: string, body: unknown, uploadOptions: { upsert?: boolean } = {}) {
            const key = `${bucket}/${path}`;
            if (storageObjects.has(key) && !uploadOptions.upsert) {
              return {
                data: null,
                error: Object.assign(new Error('The resource already exists'), {
                  statusCode: '409',
                }),
              };
            }
            storageObjects.set(key, body);
            return { data: { id: key, path, fullPath: key }, error: null };
          },
          async download(path: string) {
            const key = `${bucket}/${path}`;
            if (!storageObjects.has(key)) {
              return {
                data: null,
                error: Object.assign(new Error('Object not found'), { statusCode: '404' }),
              };
            }
            return { data: storageObjects.get(key), error: null };
          },
          async remove(paths: string[]) {
            for (const path of paths) storageObjects.delete(`${bucket}/${path}`);
            return { data: paths.map((name) => ({ name })), error: null };
          },
          async list(prefix = '') {
            const start = `${bucket}/${prefix}`;
            const names = [...storageObjects.keys()]
              .filter((k) => k.startsWith(start))
              .map((k) => ({ name: k.slice(bucket.length + 1) }));
            return { data: names, error: null };
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `guest://${bucket}/${path}` } }),
          async createSignedUrl(path: string) {
            return { data: { signedUrl: `guest://${bucket}/${path}` }, error: null };
          },
        }),
      },

      auth: {
        async getSession() {
          return { data: { session }, error: null };
        },
        async getUser() {
          return { data: { user: session.user }, error: null };
        },
        onAuthStateChange(callback: (event: string, session: unknown) => void) {
          setTimeout(() => callback('INITIAL_SESSION', session), 0);
          return { data: { subscription: { id: makeUuid(), unsubscribe() {} } } };
        },
        async signOut() {
          return { error: null };
        },
        async refreshSession() {
          return { data: { session, user: session.user }, error: null };
        },
        signUp: needsAccount,
        signInWithPassword: needsAccount,
        signInWithOAuth: async () => ({
          data: { provider: '', url: null },
          error: authError('This needs a free account. Create one to continue.'),
        }),
        resetPasswordForEmail: async () => ({
          data: null,
          error: authError('This needs a free account. Create one to continue.'),
        }),
        updateUser: async () => ({
          data: { user: null },
          error: authError('This needs a free account. Create one to continue.'),
        }),
      },
    };
    return client;
  };

  const client = buildClient({ role: 'authenticated', userId });
  const serviceClient = buildClient({ role: 'service', userId });

  const controls: GuestControls = {
    userId,
    seedIds: null,
    reset: load,
    rows: (table) => db.raw(table).map((row) => cloneJson(row)),
    setFunctionHandler(name, handler) {
      if (handler) handlers.set(name, handler);
      else handlers.delete(name);
    },
    service: serviceClient as unknown as TypedSupabaseClient,
  };

  load();
  return Object.assign(client, { guest: controls }) as unknown as GuestClient;
}
