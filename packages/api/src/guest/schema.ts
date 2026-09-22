/**
 * The database schema the in-memory client enforces, hand-transcribed from
 * supabase/migrations/*.sql: columns and types, defaults, NOT NULL, CHECK
 * constraints, foreign keys (with ON DELETE behavior) and UNIQUE constraints.
 * `__tests__/guest-schema.test.ts` checks the column lists against
 * database.types.ts so this can't silently drift from the generated types.
 *
 * Row-level security is approximated, not reproduced: every table is either
 * owned by one column (`owner`, compared to the signed-in user id), public
 * (`owner: 'public'`), or closed to the client. `ops` says which statements
 * the `authenticated` role may run (e.g. entitlements/feature_usage are
 * SELECT-only — only a service-role Edge Function may change them).
 */

export type ColType =
  'uuid' | 'text' | 'int' | 'bigint' | 'numeric' | 'bool' | 'date' | 'timestamptz' | 'jsonb';

export type ColDefault = 'uuid' | 'now' | 'today' | { value: unknown };

export interface ColumnDef {
  type: ColType;
  notNull?: boolean;
  default?: ColDefault;
  /** CHECK (col in (...)) */
  oneOf?: readonly string[];
  /** Any other CHECK — return false to violate. Only called for non-null values. */
  check?: (value: unknown) => boolean;
  ref?: { table: string; onDelete: 'cascade' | 'set null' };
}

export interface TableDef {
  columns: Record<string, ColumnDef>;
  /** Each entry is one UNIQUE constraint (the primary key is added automatically). */
  unique: string[][];
  /** Column holding the owning user's id; 'public' = readable by everyone. */
  owner: string | 'public';
  ops: { select: boolean; insert: boolean; update: boolean; delete: boolean };
}

const ALL = { select: true, insert: true, update: true, delete: true };
const READ_UPDATE = { select: true, insert: false, update: true, delete: false };
const READ_ONLY = { select: true, insert: false, update: false, delete: false };
const NONE = { select: false, insert: false, update: false, delete: false };

const id = (): ColumnDef => ({ type: 'uuid', notNull: true, default: 'uuid' });
const createdAt = (): ColumnDef => ({ type: 'timestamptz', notNull: true, default: 'now' });
const updatedAt = createdAt;
const userId = (): ColumnDef => ({
  type: 'uuid',
  notNull: true,
  ref: { table: 'profiles', onDelete: 'cascade' },
});
const ref = (
  table: string,
  opts: { notNull?: boolean; onDelete?: 'cascade' | 'set null' } = {}
): ColumnDef => ({
  type: 'uuid',
  notNull: opts.notNull ?? false,
  ref: { table, onDelete: opts.onDelete ?? (opts.notNull ? 'cascade' : 'set null') },
});
const text = (o: Partial<ColumnDef> = {}): ColumnDef => ({ type: 'text', ...o });
const bigint = (o: Partial<ColumnDef> = {}): ColumnDef => ({ type: 'bigint', ...o });
const bool = (def?: boolean): ColumnDef =>
  def === undefined ? { type: 'bool' } : { type: 'bool', notNull: true, default: { value: def } };
const date = (o: Partial<ColumnDef> = {}): ColumnDef => ({ type: 'date', ...o });
const timestamp = (o: Partial<ColumnDef> = {}): ColumnDef => ({ type: 'timestamptz', ...o });

const oneOfDefault = (values: readonly string[], def: string): ColumnDef => ({
  type: 'text',
  notNull: true,
  default: { value: def },
  oneOf: values,
});

export const TABLES: Record<string, TableDef> = {
  profiles: {
    columns: {
      id: { type: 'uuid', notNull: true },
      display_name: text({ notNull: true, default: { value: 'there' } }),
      currency: text({ notNull: true, default: { value: 'USD' } }),
      timezone: text({ notNull: true, default: { value: 'UTC' } }),
      created_at: createdAt(),
      updated_at: updatedAt(),
      onboarding_completed_at: timestamp(),
    },
    unique: [],
    owner: 'id',
    ops: READ_UPDATE,
  },
  user_settings: {
    columns: {
      user_id: userId(),
      theme_preference: oneOfDefault(['light', 'dark', 'system'], 'system'),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: READ_UPDATE,
  },
  notification_preferences: {
    columns: {
      user_id: userId(),
      bill_reminders_enabled: bool(true),
      bill_reminder_days_before: {
        type: 'int',
        notNull: true,
        default: { value: 3 },
      },
      payday_reminders_enabled: bool(true),
      goal_milestone_alerts_enabled: bool(true),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: READ_UPDATE,
  },
  households: {
    columns: {
      id: id(),
      name: text({ notNull: true }),
      created_by: userId(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'created_by',
    ops: ALL,
  },
  household_members: {
    columns: {
      id: id(),
      household_id: ref('households', { notNull: true }),
      user_id: userId(),
      role: oneOfDefault(['owner', 'member'], 'member'),
      joined_at: createdAt(),
    },
    unique: [['household_id', 'user_id']],
    owner: 'user_id',
    ops: ALL,
  },
  accounts: {
    columns: {
      id: id(),
      user_id: userId(),
      household_id: ref('households'),
      label: text({ notNull: true }),
      type: oneOfDefault(['checking', 'savings', 'cash'], 'checking'),
      balance_cents: bigint({ notNull: true, default: { value: 0 } }),
      currency: text({ notNull: true, default: { value: 'USD' } }),
      archived_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  income_sources: {
    columns: {
      id: id(),
      user_id: userId(),
      label: text({ notNull: true }),
      amount_cents: bigint({ notNull: true }),
      frequency: oneOfDefault(
        ['weekly', 'biweekly', 'twice_monthly', 'monthly', 'variable'],
        'biweekly'
      ),
      next_pay_date: date(),
      is_variable: bool(false),
      archived_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  paychecks: {
    columns: {
      id: id(),
      user_id: userId(),
      income_source_id: ref('income_sources'),
      amount_cents: bigint({ notNull: true }),
      pay_date: date({ notNull: true }),
      is_assigned: bool(false),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  budget_periods: {
    columns: {
      id: id(),
      user_id: userId(),
      period_start: date({ notNull: true }),
      period_end: date({ notNull: true }),
      rollover_applied: bool(false),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [['user_id', 'period_start']],
    owner: 'user_id',
    ops: ALL,
  },
  categories: {
    columns: {
      id: id(),
      user_id: userId(),
      name: text({ notNull: true }),
      type: oneOfDefault(['bill', 'groceries', 'savings', 'debt', 'allowance', 'other'], 'other'),
      color: text(),
      archived_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  budget_lines: {
    columns: {
      id: id(),
      user_id: userId(),
      budget_period_id: ref('budget_periods', { notNull: true }),
      category_id: ref('categories', { notNull: true }),
      planned_cents: bigint({ notNull: true, default: { value: 0 } }),
      created_at: createdAt(),
      updated_at: updatedAt(),
      actual_override_cents: bigint({ check: (v) => typeof v === 'number' && v >= 0 }),
    },
    unique: [['budget_period_id', 'category_id']],
    owner: 'user_id',
    ops: ALL,
  },
  transactions: {
    columns: {
      id: id(),
      user_id: userId(),
      account_id: ref('accounts'),
      category_id: ref('categories'),
      amount_cents: bigint({ notNull: true }),
      occurred_on: date({ notNull: true }),
      label: text({ notNull: true }),
      note: text(),
      deleted_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  bills: {
    columns: {
      id: id(),
      user_id: userId(),
      category_id: ref('categories'),
      label: text({ notNull: true }),
      amount_cents: bigint({ notNull: true }),
      due_date: date({ notNull: true }),
      recurrence: oneOfDefault(['none', 'weekly', 'biweekly', 'monthly', 'yearly'], 'monthly'),
      autopay: bool(false),
      reminder_days_before: { type: 'int', notNull: true, default: { value: 3 } },
      archived_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
      reminder_enabled: bool(true),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  bill_payments: {
    columns: {
      id: id(),
      user_id: userId(),
      bill_id: ref('bills', { notNull: true }),
      amount_cents: bigint({ notNull: true }),
      paid_on: date({ notNull: true }),
      note: text(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  debts: {
    columns: {
      id: id(),
      user_id: userId(),
      label: text({ notNull: true }),
      type: oneOfDefault(
        ['creditCard', 'autoLoan', 'mortgage', 'heloc', 'personalLoan', 'studentLoan', 'other'],
        'creditCard'
      ),
      balance_cents: bigint({ notNull: true }),
      apr_basis_points: { type: 'int', notNull: true, default: { value: 0 } },
      minimum_payment_cents: bigint({ notNull: true, default: { value: 0 } }),
      credit_limit_cents: bigint(),
      due_day: { type: 'int' },
      archived_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
      original_balance_cents: bigint(),
      planned_payment_cents: bigint(),
      notes: text(),
      issuer: text(),
      last4: text({ check: (v) => typeof v === 'string' && /^[0-9]{4}$/.test(v) }),
      network: text(),
      card_style: text(),
      card_text_mode: oneOfDefault(['auto', 'light', 'dark'], 'auto'),
      promo_balance_cents: bigint(),
      promo_apr_basis_points: { type: 'int' },
      promo_expires_on: date(),
      lender: text(),
      term_months: { type: 'int' },
      started_on: date(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  debt_payments: {
    columns: {
      id: id(),
      user_id: userId(),
      debt_id: ref('debts', { notNull: true }),
      amount_cents: bigint({ notNull: true }),
      paid_on: date({ notNull: true }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  payoff_plans: {
    columns: {
      id: id(),
      user_id: userId(),
      strategy: oneOfDefault(['snowball', 'avalanche'], 'avalanche'),
      extra_monthly_cents: bigint({ notNull: true, default: { value: 0 } }),
      created_at: createdAt(),
      updated_at: updatedAt(),
      card_goal_target_cents: bigint(),
      card_goal_target_date: date(),
      card_goal_monthly_cents: bigint(),
    },
    unique: [['user_id']],
    owner: 'user_id',
    ops: ALL,
  },
  payday_assignments: {
    columns: {
      id: id(),
      user_id: userId(),
      income_source_id: ref('income_sources', { notNull: true }),
      pay_date: date({ notNull: true }),
      target_type: {
        type: 'text',
        notNull: true,
        oneOf: ['bill', 'debt', 'savings_goal'],
      },
      target_id: { type: 'uuid', notNull: true },
      amount_cents: bigint({
        notNull: true,
        check: (v) => typeof v === 'number' && v > 0,
      }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [['income_source_id', 'pay_date', 'target_type', 'target_id']],
    owner: 'user_id',
    ops: ALL,
  },
  savings_goals: {
    columns: {
      id: id(),
      user_id: userId(),
      label: text({ notNull: true }),
      target_cents: bigint({ notNull: true }),
      saved_cents: bigint({ notNull: true, default: { value: 0 } }),
      target_date: date(),
      is_challenge: bool(false),
      archived_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
      category: text(),
      frequency: oneOfDefault(['weekly', 'biweekly', 'monthly'], 'monthly'),
      start_date: date(),
      planned_deposit_cents: bigint({ check: (v) => typeof v === 'number' && v >= 0 }),
      account_label: text(),
      color: text(),
      notes: text(),
      paused_at: timestamp(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  goal_activity: {
    columns: {
      id: id(),
      user_id: userId(),
      goal_id: ref('savings_goals', { notNull: true }),
      amount_cents: bigint({ notNull: true }),
      kind: oneOfDefault(['deposit', 'withdrawal'], 'deposit'),
      note: text(),
      occurred_on: date({ notNull: true, default: 'today' }),
      created_at: createdAt(),
      challenge_week: {
        type: 'int',
        check: (v) => typeof v === 'number' && v > 0,
      },
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  savings_challenges: {
    columns: {
      id: id(),
      user_id: userId(),
      goal_id: ref('savings_goals'),
      challenge_type: oneOfDefault(
        ['classic_ascending', 'flat', 'reverse', 'custom'],
        'classic_ascending'
      ),
      cadence: oneOfDefault(['weekly', 'biweekly'], 'weekly'),
      total_weeks: { type: 'int', notNull: true, default: { value: 52 } },
      created_at: createdAt(),
      updated_at: updatedAt(),
      multiplier: {
        type: 'numeric',
        notNull: true,
        default: { value: 1 },
        check: (v) => typeof v === 'number' && v > 0,
      },
      start_date: date(),
      notes: text(),
      block_notes: { type: 'jsonb', notNull: true, default: { value: {} } },
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  receipts: {
    columns: {
      id: id(),
      user_id: userId(),
      store_label: text(),
      purchased_on: date(),
      subtotal_cents: bigint(),
      tax_cents: bigint(),
      total_cents: bigint(),
      image_storage_path: text(),
      ai_extraction_status: oneOfDefault(['pending', 'confirmed', 'failed'], 'pending'),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  receipt_items: {
    columns: {
      id: id(),
      user_id: userId(),
      receipt_id: ref('receipts', { notNull: true }),
      label: text({ notNull: true }),
      category: text(),
      price_cents: bigint({ notNull: true }),
      quantity: { type: 'numeric', notNull: true, default: { value: 1 } },
      created_at: createdAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  pantry_scans: {
    columns: {
      id: id(),
      user_id: userId(),
      image_storage_path: text(),
      ai_extraction_status: oneOfDefault(['pending', 'confirmed', 'failed'], 'pending'),
      created_at: createdAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  grocery_lists: {
    columns: {
      id: id(),
      user_id: userId(),
      label: text({ notNull: true, default: { value: 'Grocery List' } }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  grocery_items: {
    columns: {
      id: id(),
      user_id: userId(),
      grocery_list_id: ref('grocery_lists', { notNull: true }),
      label: text({ notNull: true }),
      estimated_price_cents: bigint(),
      is_checked: bool(false),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  missions: {
    columns: {
      id: id(),
      slug: text({ notNull: true }),
      title: text({ notNull: true }),
      description: text({ notNull: true }),
      age_group: text(),
      is_active: bool(true),
      created_at: createdAt(),
    },
    unique: [['slug']],
    owner: 'public',
    ops: READ_ONLY,
  },
  user_missions: {
    columns: {
      id: id(),
      user_id: userId(),
      mission_id: ref('missions', { notNull: true }),
      status: oneOfDefault(['active', 'completed', 'abandoned'], 'active'),
      started_at: createdAt(),
      completed_at: timestamp(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: ALL,
  },
  entitlements: {
    columns: {
      user_id: userId(),
      plan_tier: oneOfDefault(['free', 'guided', 'budgetBuddy'], 'free'),
      status: oneOfDefault(['active', 'trialing', 'past_due', 'canceled'], 'active'),
      trial_ends_at: timestamp(),
      current_period_end: timestamp(),
      stripe_customer_id: text(),
      revenuecat_app_user_id: text(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: READ_ONLY,
  },
  feature_usage: {
    columns: {
      id: id(),
      user_id: userId(),
      feature_key: {
        type: 'text',
        notNull: true,
        oneOf: [
          'receiptScan',
          'pantryScan',
          'savingsGoal',
          'mission',
          'budgetBuddyAction',
          'advancedDebtScenarios',
          'fullReports',
          'householdSharing',
        ],
      },
      period_start: date({ notNull: true }),
      used_count: { type: 'int', notNull: true, default: { value: 0 } },
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    unique: [['user_id', 'feature_key', 'period_start']],
    owner: 'user_id',
    ops: READ_ONLY,
  },
  audit_log: {
    columns: {
      id: id(),
      user_id: { type: 'uuid', ref: { table: 'profiles', onDelete: 'cascade' } },
      actor: oneOfDefault(['user', 'ai', 'system'], 'user'),
      action: text({ notNull: true }),
      entity_table: text(),
      entity_id: { type: 'uuid' },
      metadata: { type: 'jsonb' },
      created_at: createdAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: READ_ONLY,
  },
  processed_webhook_events: {
    columns: {
      id: text({ notNull: true }),
      source: { type: 'text', notNull: true, oneOf: ['stripe', 'revenuecat'] },
      processed_at: createdAt(),
    },
    unique: [],
    owner: 'user_id',
    ops: NONE,
  },
};

/** Which column is the primary key (only `profiles`, `user_settings` etc. differ from `id`). */
export function primaryKeyOf(table: string): string {
  if (table === 'user_settings' || table === 'notification_preferences') return 'user_id';
  if (table === 'entitlements') return 'user_id';
  return 'id';
}
