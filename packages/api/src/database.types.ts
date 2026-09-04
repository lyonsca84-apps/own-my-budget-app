// AUTO-GENERATED — do not hand-edit. Regenerate after any migration with:
//   (Supabase MCP) generate_typescript_types, project soapkqeaodjawxrvslob
// or, once the Supabase CLI is set up locally:
//   supabase gen types typescript --project-id soapkqeaodjawxrvslob > src/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          archived_at: string | null;
          balance_cents: number;
          created_at: string;
          currency: string;
          household_id: string | null;
          id: string;
          label: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          balance_cents?: number;
          created_at?: string;
          currency?: string;
          household_id?: string | null;
          id?: string;
          label: string;
          type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          balance_cents?: number;
          created_at?: string;
          currency?: string;
          household_id?: string | null;
          id?: string;
          label?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string;
          created_at: string;
          entity_id: string | null;
          entity_table: string | null;
          id: string;
          metadata: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          actor?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_table?: string | null;
          id?: string;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_table?: string | null;
          id?: string;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      bill_payments: {
        Row: {
          amount_cents: number;
          bill_id: string;
          created_at: string;
          id: string;
          note: string | null;
          paid_on: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          bill_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          paid_on: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          bill_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          paid_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bill_payments_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'bills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bill_payments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      bills: {
        Row: {
          amount_cents: number;
          archived_at: string | null;
          autopay: boolean;
          category_id: string | null;
          created_at: string;
          due_date: string;
          id: string;
          label: string;
          recurrence: string;
          reminder_days_before: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          archived_at?: string | null;
          autopay?: boolean;
          category_id?: string | null;
          created_at?: string;
          due_date: string;
          id?: string;
          label: string;
          recurrence?: string;
          reminder_days_before?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          archived_at?: string | null;
          autopay?: boolean;
          category_id?: string | null;
          created_at?: string;
          due_date?: string;
          id?: string;
          label?: string;
          recurrence?: string;
          reminder_days_before?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bills_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bills_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      budget_lines: {
        Row: {
          budget_period_id: string;
          category_id: string;
          created_at: string;
          id: string;
          planned_cents: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_period_id: string;
          category_id: string;
          created_at?: string;
          id?: string;
          planned_cents?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_period_id?: string;
          category_id?: string;
          created_at?: string;
          id?: string;
          planned_cents?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_lines_budget_period_id_fkey';
            columns: ['budget_period_id'];
            isOneToOne: false;
            referencedRelation: 'budget_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_lines_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_lines_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      budget_periods: {
        Row: {
          created_at: string;
          id: string;
          period_end: string;
          period_start: string;
          rollover_applied: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          period_end: string;
          period_start: string;
          rollover_applied?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          period_end?: string;
          period_start?: string;
          rollover_applied?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_periods_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      debt_payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          debt_id: string;
          id: string;
          paid_on: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          debt_id: string;
          id?: string;
          paid_on: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          debt_id?: string;
          id?: string;
          paid_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'debt_payments_debt_id_fkey';
            columns: ['debt_id'];
            isOneToOne: false;
            referencedRelation: 'debts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'debt_payments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      debts: {
        Row: {
          apr_basis_points: number;
          archived_at: string | null;
          balance_cents: number;
          created_at: string;
          credit_limit_cents: number | null;
          due_day: number | null;
          id: string;
          label: string;
          minimum_payment_cents: number;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          apr_basis_points?: number;
          archived_at?: string | null;
          balance_cents: number;
          created_at?: string;
          credit_limit_cents?: number | null;
          due_day?: number | null;
          id?: string;
          label: string;
          minimum_payment_cents?: number;
          type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          apr_basis_points?: number;
          archived_at?: string | null;
          balance_cents?: number;
          created_at?: string;
          credit_limit_cents?: number | null;
          due_day?: number | null;
          id?: string;
          label?: string;
          minimum_payment_cents?: number;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'debts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      entitlements: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          plan_tier: string;
          revenuecat_app_user_id: string | null;
          status: string;
          stripe_customer_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          plan_tier?: string;
          revenuecat_app_user_id?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          plan_tier?: string;
          revenuecat_app_user_id?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entitlements_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_usage: {
        Row: {
          created_at: string;
          feature_key: string;
          id: string;
          period_start: string;
          updated_at: string;
          used_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          feature_key: string;
          id?: string;
          period_start: string;
          updated_at?: string;
          used_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feature_key?: string;
          id?: string;
          period_start?: string;
          updated_at?: string;
          used_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      goal_activity: {
        Row: {
          amount_cents: number;
          created_at: string;
          goal_id: string;
          id: string;
          kind: string;
          note: string | null;
          occurred_on: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          goal_id: string;
          id?: string;
          kind?: string;
          note?: string | null;
          occurred_on?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          goal_id?: string;
          id?: string;
          kind?: string;
          note?: string | null;
          occurred_on?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goal_activity_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'goal_activity_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      grocery_items: {
        Row: {
          created_at: string;
          estimated_price_cents: number | null;
          grocery_list_id: string;
          id: string;
          is_checked: boolean;
          label: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          estimated_price_cents?: number | null;
          grocery_list_id: string;
          id?: string;
          is_checked?: boolean;
          label: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          estimated_price_cents?: number | null;
          grocery_list_id?: string;
          id?: string;
          is_checked?: boolean;
          label?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'grocery_items_grocery_list_id_fkey';
            columns: ['grocery_list_id'];
            isOneToOne: false;
            referencedRelation: 'grocery_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'grocery_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      grocery_lists: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'grocery_lists_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      household_members: {
        Row: {
          household_id: string;
          id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          household_id: string;
          id?: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          household_id?: string;
          id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'households_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      income_sources: {
        Row: {
          amount_cents: number;
          archived_at: string | null;
          created_at: string;
          frequency: string;
          id: string;
          is_variable: boolean;
          label: string;
          next_pay_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          archived_at?: string | null;
          created_at?: string;
          frequency?: string;
          id?: string;
          is_variable?: boolean;
          label: string;
          next_pay_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          archived_at?: string | null;
          created_at?: string;
          frequency?: string;
          id?: string;
          is_variable?: boolean;
          label?: string;
          next_pay_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'income_sources_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      missions: {
        Row: {
          age_group: string | null;
          created_at: string;
          description: string;
          id: string;
          is_active: boolean;
          slug: string;
          title: string;
        };
        Insert: {
          age_group?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          is_active?: boolean;
          slug: string;
          title: string;
        };
        Update: {
          age_group?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          slug?: string;
          title?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          bill_reminder_days_before: number;
          bill_reminders_enabled: boolean;
          created_at: string;
          goal_milestone_alerts_enabled: boolean;
          payday_reminders_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bill_reminder_days_before?: number;
          bill_reminders_enabled?: boolean;
          created_at?: string;
          goal_milestone_alerts_enabled?: boolean;
          payday_reminders_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bill_reminder_days_before?: number;
          bill_reminders_enabled?: boolean;
          created_at?: string;
          goal_milestone_alerts_enabled?: boolean;
          payday_reminders_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pantry_scans: {
        Row: {
          ai_extraction_status: string;
          created_at: string;
          id: string;
          image_storage_path: string | null;
          user_id: string;
        };
        Insert: {
          ai_extraction_status?: string;
          created_at?: string;
          id?: string;
          image_storage_path?: string | null;
          user_id: string;
        };
        Update: {
          ai_extraction_status?: string;
          created_at?: string;
          id?: string;
          image_storage_path?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pantry_scans_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      paychecks: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          income_source_id: string | null;
          is_assigned: boolean;
          pay_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          income_source_id?: string | null;
          is_assigned?: boolean;
          pay_date: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          income_source_id?: string | null;
          is_assigned?: boolean;
          pay_date?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'paychecks_income_source_id_fkey';
            columns: ['income_source_id'];
            isOneToOne: false;
            referencedRelation: 'income_sources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paychecks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payoff_plans: {
        Row: {
          created_at: string;
          extra_monthly_cents: number;
          id: string;
          strategy: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          extra_monthly_cents?: number;
          id?: string;
          strategy?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          extra_monthly_cents?: number;
          id?: string;
          strategy?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payoff_plans_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      processed_webhook_events: {
        Row: {
          id: string;
          processed_at: string;
          source: string;
        };
        Insert: {
          id: string;
          processed_at?: string;
          source: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          currency: string;
          display_name: string;
          id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          display_name?: string;
          id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          display_name?: string;
          id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      receipt_items: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          label: string;
          price_cents: number;
          quantity: number;
          receipt_id: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          label: string;
          price_cents: number;
          quantity?: number;
          receipt_id: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          label?: string;
          price_cents?: number;
          quantity?: number;
          receipt_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receipt_items_receipt_id_fkey';
            columns: ['receipt_id'];
            isOneToOne: false;
            referencedRelation: 'receipts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipt_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      receipts: {
        Row: {
          ai_extraction_status: string;
          created_at: string;
          id: string;
          image_storage_path: string | null;
          purchased_on: string | null;
          store_label: string | null;
          subtotal_cents: number | null;
          tax_cents: number | null;
          total_cents: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_extraction_status?: string;
          created_at?: string;
          id?: string;
          image_storage_path?: string | null;
          purchased_on?: string | null;
          store_label?: string | null;
          subtotal_cents?: number | null;
          tax_cents?: number | null;
          total_cents?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_extraction_status?: string;
          created_at?: string;
          id?: string;
          image_storage_path?: string | null;
          purchased_on?: string | null;
          store_label?: string | null;
          subtotal_cents?: number | null;
          tax_cents?: number | null;
          total_cents?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receipts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_challenges: {
        Row: {
          cadence: string;
          challenge_type: string;
          created_at: string;
          goal_id: string | null;
          id: string;
          total_weeks: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cadence?: string;
          challenge_type?: string;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          total_weeks?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cadence?: string;
          challenge_type?: string;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          total_weeks?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'savings_challenges_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'savings_challenges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_goals: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          is_challenge: boolean;
          label: string;
          saved_cents: number;
          target_cents: number;
          target_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_challenge?: boolean;
          label: string;
          saved_cents?: number;
          target_cents: number;
          target_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_challenge?: boolean;
          label?: string;
          saved_cents?: number;
          target_cents?: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'savings_goals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string | null;
          amount_cents: number;
          category_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          label: string;
          note: string | null;
          occurred_on: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          amount_cents: number;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label: string;
          note?: string | null;
          occurred_on: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          amount_cents?: number;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label?: string;
          note?: string | null;
          occurred_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_missions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          mission_id: string;
          started_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          mission_id: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          mission_id?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_missions_mission_id_fkey';
            columns: ['mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_missions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          created_at: string;
          theme_preference: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          theme_preference?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          theme_preference?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      record_debt_payment: {
        Args: { p_amount_cents: number; p_debt_id: string; p_paid_on: string };
        Returns: {
          amount_cents: number;
          created_at: string;
          debt_id: string;
          id: string;
          paid_on: string;
          updated_at: string;
          user_id: string;
        };
      };
      record_goal_activity: {
        Args: {
          p_amount_cents: number;
          p_goal_id: string;
          p_kind: string;
          p_note: string;
          p_occurred_on: string;
        };
        Returns: {
          amount_cents: number;
          created_at: string;
          goal_id: string;
          id: string;
          kind: string;
          note: string | null;
          occurred_on: string;
          user_id: string;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
