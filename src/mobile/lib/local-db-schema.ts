/**
 * Local SQLite schema for offline-first storage.
 * Mirrors the server Postgres schema with additional sync metadata columns.
 *
 * Tables prefixed with `local_` hold user-facing data.
 * Tables prefixed with `sync_` hold sync infrastructure data.
 */

export const LOCAL_DB_VERSION = 1;

export const LOCAL_DB_SCHEMA = `
-- ===== User-facing data tables =====

CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,
  phone TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  upi_id TEXT,
  default_currency TEXT DEFAULT 'INR',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'INR',
  created_by TEXT NOT NULL,
  avatar_url TEXT,
  is_archived INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT,
  FOREIGN KEY (group_id) REFERENCES local_groups(id)
);

CREATE TABLE IF NOT EXISTS local_expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  paid_by TEXT NOT NULL,
  category TEXT,
  split_type TEXT NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  percentage REAL,
  settled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT,
  FOREIGN KEY (expense_id) REFERENCES local_expenses(id)
);

CREATE TABLE IF NOT EXISTS local_settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  payer_id TEXT NOT NULL,
  payee_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT,
  upi_transaction_id TEXT,
  payment_method TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_activity_log (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _last_synced_at TEXT
);

-- ===== Sync infrastructure tables =====

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','failed','completed'))
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  local_data TEXT NOT NULL,
  server_data TEXT NOT NULL,
  resolution TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ===== Indexes =====

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_local_expenses_group ON local_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_local_expense_splits_expense ON local_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_local_group_members_group ON local_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_local_groups_sync ON local_groups(_sync_status);
CREATE INDEX IF NOT EXISTS idx_local_expenses_sync ON local_expenses(_sync_status);
`;
