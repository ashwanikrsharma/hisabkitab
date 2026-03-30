/**
 * TypeScript types matching the HisabKitab database schema.
 * All tables have RLS enabled — queries use the anon or service_role key accordingly.
 *
 * Table definitions match supabase/migrations/*.sql
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type SplitType = 'equal' | 'exact' | 'percentage';
export type SettlementStatus = 'pending' | 'confirmed' | 'disputed';
export type AuditAction = 'create' | 'update' | 'delete' | 'settle';
export type AgentName = 'expense-parser' | 'chat-assistant' | 'reminder';

// ─── Core Tables ──────────────────────────────────────────────────────────────

export type User = {
  id: string; // uuid — matches auth.users.id
  phone: string;
  name: string;
  avatar_url: string | null;
  upi_id: string | null;
  default_currency: string; // ISO 4217, e.g. 'INR'
  created_at: string; // ISO timestamp
  updated_at: string;
};

export type Group = {
  id: string; // uuid
  name: string;
  description: string | null;
  currency: string; // default currency for this group
  created_by: string; // user.id
  avatar_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  is_active: boolean;
};

export type Expense = {
  id: string;
  group_id: string | null;
  description: string;
  amount: number; // stored as numeric in Postgres
  currency: string;
  paid_by: string; // user.id
  category: string | null;
  split_type: SplitType;
  receipt_url: string | null;
  notes: string | null;
  created_by: string; // user.id (may differ from paid_by)
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number; // this user's share
  percentage: number | null; // used when split_type = 'percentage'
  settled: boolean;
  created_at: string;
};

export type Settlement = {
  id: string;
  group_id: string | null;
  payer_id: string; // user who paid
  payee_id: string; // user who received
  amount: number;
  currency: string;
  status: SettlementStatus;
  note: string | null;
  upi_transaction_id: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Activity Log ────────────────────────────────────────────────────────────

export type ActivityType = 'expense_added' | 'expense_deleted' | 'settlement_created' | 'member_joined' | 'group_created' | 'group_renamed' | 'group_archived';

export type Activity = {
  id: string;
  group_id: string | null;
  actor_id: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ─── Observability / Admin ────────────────────────────────────────────────────

export type AdminAuditLog = {
  id: string;
  actor_id: string; // user.id who performed the action
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export type AnalyticsDaily = {
  id: string;
  date: string; // YYYY-MM-DD
  group_id: string | null; // null = platform-wide
  new_expenses: number;
  total_expense_amount: number;
  ai_calls: number;
  ai_tokens_used: number;
  active_users: number;
  created_at: string;
};

// ─── Push Tokens ─────────────────────────────────────────────────────────────

export type PushTokenPlatform = 'ios' | 'android' | 'web';

export type PushToken = {
  id: string;
  user_id: string;
  token: string;
  platform: PushTokenPlatform;
  device_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ─── Agent Metrics ───────────────────────────────────────────────────────────

export type AgentMetric = {
  id: string;
  agent_name: AgentName;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: boolean;
  error_message: string | null;
  group_id: string | null;
  user_id: string | null;
  created_at: string;
};

// ─── Supabase Database Type Map ───────────────────────────────────────────────

// Row type helper for table shapes required by @supabase/supabase-js v2.43+
type TableDef<TRow, TInsert, TUpdate> = {
  Row: TRow;
  Insert: TInsert;
  Update: TUpdate;
  Relationships: never[];
};

// Precise Insert types — nullable fields are optional (DB defaults to NULL)
type UserInsert = {
  id: string; // mirrors auth.users.id
  phone: string;
  name: string;
  avatar_url?: string | null;
  upi_id?: string | null;
  default_currency?: string;
};

type GroupInsert = {
  name: string;
  currency?: string;
  description?: string | null;
  created_by: string;
  avatar_url?: string | null;
  is_archived?: boolean;
};

type GroupMemberInsert = {
  group_id: string;
  user_id: string;
  role?: 'admin' | 'member';
  is_active?: boolean;
};

type ExpenseInsert = {
  group_id?: string | null;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  split_type: SplitType;
  created_by: string;
  category?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  deleted_at?: string | null;
};

type ExpenseSplitInsert = {
  expense_id: string;
  user_id: string;
  amount: number;
  percentage?: number | null;
  settled?: boolean;
};

type SettlementInsert = {
  group_id?: string | null;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  status?: SettlementStatus;
  note?: string | null;
  upi_transaction_id?: string | null;
  payment_method?: string | null;
};

type ActivityInsert = {
  group_id?: string | null;
  actor_id: string;
  type: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown> | null;
};

type AdminAuditLogInsert = {
  actor_id: string;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
};

type AgentMetricInsert = {
  agent_name: string;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: boolean;
  error_message?: string | null;
  group_id?: string | null;
  user_id?: string | null;
};

type PushTokenInsert = {
  user_id: string;
  token: string;
  platform: PushTokenPlatform;
  device_id?: string | null;
  is_active?: boolean;
};

type AnalyticsDailyInsert = {
  date: string;
  group_id?: string | null;
  new_expenses?: number;
  total_expense_amount?: number;
  ai_calls?: number;
  ai_tokens_used?: number;
  active_users?: number;
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<User, UserInsert, Partial<User>>;
      groups: TableDef<Group, GroupInsert, Partial<Group>>;
      group_members: TableDef<GroupMember, GroupMemberInsert, Partial<GroupMember>>;
      expenses: TableDef<Expense, ExpenseInsert, Partial<Expense>>;
      expense_splits: TableDef<ExpenseSplit, ExpenseSplitInsert, Partial<ExpenseSplit>>;
      settlements: TableDef<Settlement, SettlementInsert, Partial<Settlement>>;
      activity_log: TableDef<Activity, ActivityInsert, Partial<Activity>>;
      admin_audit_log: TableDef<AdminAuditLog, AdminAuditLogInsert, never>;
      agent_metrics: TableDef<AgentMetric, AgentMetricInsert, never>;
      push_tokens: TableDef<PushToken, PushTokenInsert, Partial<PushToken>>;
      analytics_daily: TableDef<AnalyticsDaily, AnalyticsDailyInsert, Partial<AnalyticsDaily>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
