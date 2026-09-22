import { Database, type Ctx } from './db';
import { GuestPostgrestError, pgError } from './errors';
import { formatDate } from './dates';
import { TABLES } from './schema';
import { cloneJson, coerceValue, type Row } from './values';
import type { QueryResponse } from './query-builder';

/**
 * Re-implementations of every Postgres function the app calls through
 * `client.rpc(...)` (supabase/migrations/20260905000100 and 20260905010000).
 * Each runs inside one journaled transaction, so like the real functions a
 * failure part-way leaves no half-written state.
 */

type RpcArgs = Record<string, unknown>;

interface RpcFunction {
  params: string[];
  /** Revoked from `authenticated` in SQL — only a service-role caller may run it. */
  serviceOnly?: boolean;
  run: (args: RpcArgs, ctx: Ctx, db: Database) => Row;
}

function arg(table: string, column: string, value: unknown): unknown {
  return coerceValue(TABLES[table].columns[column], value);
}

const FUNCTIONS: Record<string, RpcFunction> = {
  // Inserts the payment and lowers the debt's running balance (floored at 0).
  record_debt_payment: {
    params: ['p_amount_cents', 'p_debt_id', 'p_paid_on'],
    run(args, ctx, db) {
      const payment = db.insertRow(
        'debt_payments',
        {
          user_id: ctx.userId,
          debt_id: arg('debt_payments', 'debt_id', args.p_debt_id),
          amount_cents: arg('debt_payments', 'amount_cents', args.p_amount_cents),
          paid_on: arg('debt_payments', 'paid_on', args.p_paid_on),
        },
        ctx
      );
      const amount = payment.amount_cents as number;
      for (const debt of db.visible('debts', ctx)) {
        if (debt.id !== payment.debt_id) continue;
        const balance = Math.max((debt.balance_cents as number) - amount, 0);
        db.updateRow('debts', debt, { balance_cents: balance }, ctx);
      }
      return payment;
    },
  },

  // Inserts a deposit/withdrawal and moves the goal's saved total (floored at 0).
  record_goal_activity: {
    params: ['p_amount_cents', 'p_goal_id', 'p_kind', 'p_note', 'p_occurred_on'],
    run(args, ctx, db) {
      const kind = args.p_kind;
      if (kind !== 'deposit' && kind !== 'withdrawal') {
        throw pgError(
          `record_goal_activity: kind must be deposit or withdrawal, got ${String(kind)}`,
          'P0001'
        );
      }
      const occurredOn =
        args.p_occurred_on === null || args.p_occurred_on === undefined
          ? formatDate(db.clock())
          : arg('goal_activity', 'occurred_on', args.p_occurred_on);
      const activity = db.insertRow(
        'goal_activity',
        {
          user_id: ctx.userId,
          goal_id: arg('goal_activity', 'goal_id', args.p_goal_id),
          amount_cents: arg('goal_activity', 'amount_cents', args.p_amount_cents),
          kind,
          note: args.p_note ?? null,
          occurred_on: occurredOn,
        },
        ctx
      );
      const amount = activity.amount_cents as number;
      const delta = kind === 'deposit' ? amount : -amount;
      for (const goal of db.visible('savings_goals', ctx)) {
        if (goal.id !== activity.goal_id) continue;
        const saved = Math.max((goal.saved_cents as number) + delta, 0);
        db.updateRow('savings_goals', goal, { saved_cents: saved }, ctx);
      }
      return activity;
    },
  },

  // Edits a deposit/withdrawal and moves the goal's saved total by the difference (floored at 0).
  update_goal_activity: {
    params: ['p_activity_id', 'p_amount_cents', 'p_note', 'p_occurred_on'],
    run(args, ctx, db) {
      const id = arg('goal_activity', 'id', args.p_activity_id);
      const amount = arg('goal_activity', 'amount_cents', args.p_amount_cents);
      if (typeof amount !== 'number' || amount <= 0) {
        throw pgError('update_goal_activity: amount must be greater than zero', 'P0001');
      }
      const old = db.visible('goal_activity', ctx).find((r) => r.id === id);
      if (!old) throw pgError(`update_goal_activity: activity ${String(id)} not found`, 'P0001');
      const oldAmount = old.amount_cents as number;
      const kind = old.kind as string;
      const updated = db.updateRow(
        'goal_activity',
        old,
        {
          amount_cents: amount,
          occurred_on:
            args.p_occurred_on === null || args.p_occurred_on === undefined
              ? old.occurred_on
              : arg('goal_activity', 'occurred_on', args.p_occurred_on),
          note: args.p_note ?? null,
        },
        ctx
      );
      const delta = (amount - oldAmount) * (kind === 'deposit' ? 1 : -1);
      for (const goal of db.visible('savings_goals', ctx)) {
        if (goal.id !== old.goal_id) continue;
        const saved = Math.max((goal.saved_cents as number) + delta, 0);
        db.updateRow('savings_goals', goal, { saved_cents: saved }, ctx);
      }
      return updated;
    },
  },

  // Removes a deposit/withdrawal and reverses its effect on the goal's saved total (floored at 0).
  delete_goal_activity: {
    params: ['p_activity_id'],
    run(args, ctx, db) {
      const id = arg('goal_activity', 'id', args.p_activity_id);
      const old = db.visible('goal_activity', ctx).find((r) => r.id === id);
      if (!old) throw pgError(`delete_goal_activity: activity ${String(id)} not found`, 'P0001');
      const copy = { ...old };
      db.deleteRow('goal_activity', old);
      const amount = old.amount_cents as number;
      const delta = old.kind === 'deposit' ? -amount : amount;
      for (const goal of db.visible('savings_goals', ctx)) {
        if (goal.id !== old.goal_id) continue;
        const saved = Math.max((goal.saved_cents as number) + delta, 0);
        db.updateRow('savings_goals', goal, { saved_cents: saved }, ctx);
      }
      return copy;
    },
  },

  // Logs one week of a 52-week challenge as a tagged deposit; a week can only be recorded once.
  record_challenge_week: {
    params: ['p_amount_cents', 'p_goal_id', 'p_occurred_on', 'p_week'],
    run(args, ctx, db) {
      const week = arg('goal_activity', 'challenge_week', args.p_week);
      if (typeof week !== 'number' || week <= 0) {
        throw pgError(`record_challenge_week: week must be positive, got ${String(week)}`, 'P0001');
      }
      const amount = arg('goal_activity', 'amount_cents', args.p_amount_cents);
      if (typeof amount !== 'number' || amount <= 0) {
        throw pgError('record_challenge_week: amount must be greater than zero', 'P0001');
      }
      const goalId = arg('goal_activity', 'goal_id', args.p_goal_id);
      if (
        db
          .visible('goal_activity', ctx)
          .some((r) => r.goal_id === goalId && r.challenge_week === week)
      ) {
        throw pgError(`record_challenge_week: week ${week} is already recorded`, 'P0001');
      }
      const activity = db.insertRow(
        'goal_activity',
        {
          user_id: ctx.userId,
          goal_id: goalId,
          amount_cents: amount,
          kind: 'deposit',
          note: `Week ${week}`,
          occurred_on:
            args.p_occurred_on === null || args.p_occurred_on === undefined
              ? formatDate(db.clock())
              : arg('goal_activity', 'occurred_on', args.p_occurred_on),
          challenge_week: week,
        },
        ctx
      );
      for (const goal of db.visible('savings_goals', ctx)) {
        if (goal.id !== goalId) continue;
        db.updateRow(
          'savings_goals',
          goal,
          { saved_cents: (goal.saved_cents as number) + amount },
          ctx
        );
      }
      return activity;
    },
  },

  // Atomic upsert-or-increment; Edge Functions only (EXECUTE is revoked from `authenticated`).
  increment_feature_usage: {
    params: ['p_feature_key', 'p_period_start', 'p_user_id'],
    serviceOnly: true,
    run(args, ctx, db) {
      const userId = arg('feature_usage', 'user_id', args.p_user_id) as string;
      const featureKey = arg('feature_usage', 'feature_key', args.p_feature_key) as string;
      const periodStart = arg('feature_usage', 'period_start', args.p_period_start) as string;
      const existing = db
        .raw('feature_usage')
        .find(
          (r) =>
            r.user_id === userId && r.feature_key === featureKey && r.period_start === periodStart
        );
      if (existing) {
        return db.updateRow(
          'feature_usage',
          existing,
          { used_count: (existing.used_count as number) + 1 },
          ctx
        );
      }
      return db.insertRow(
        'feature_usage',
        {
          user_id: userId,
          feature_key: featureKey,
          period_start: periodStart,
          used_count: 1,
        },
        ctx
      );
    },
  },
};

/** The names of every supported RPC (for tests and docs). */
export const RPC_NAMES = Object.keys(FUNCTIONS);

export class RpcBuilder implements PromiseLike<QueryResponse> {
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private shouldThrow = false;

  constructor(
    private readonly db: Database,
    private readonly ctx: Ctx,
    private readonly name: string,
    private readonly args: RpcArgs,
    private readonly latencyMs: number
  ) {}

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
  abortSignal(): this {
    return this;
  }
  overrideTypes(): this {
    return this;
  }

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
      response = {
        data: this.call(),
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      };
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

  private call(): unknown {
    const fn = FUNCTIONS[this.name];
    const given = Object.keys(this.args ?? {});
    const signature = `${this.name}(${given.sort().join(', ')})`;
    if (
      !fn ||
      fn.params.some((p) => !given.includes(p)) ||
      given.some((g) => !fn.params.includes(g))
    ) {
      throw pgError(
        `Could not find the function public.${signature} in the schema cache`,
        'PGRST202',
        {
          details: `Searched for the function public.${this.name} with parameter names ${given.join(', ')} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`,
          status: 404,
        }
      );
    }
    if (fn.serviceOnly && this.ctx.role !== 'service') {
      throw pgError(`permission denied for function ${this.name}`, '42501', { status: 403 });
    }
    const row = this.db.transaction(() => fn.run(this.args, this.ctx, this.db));
    // A composite-returning function comes back as a single object (or null if it had no result).
    return cloneJson(row);
  }
}
