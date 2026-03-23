/**
 * Local SQLite database initialization and typed CRUD helpers.
 *
 * All write operations use transactions for atomicity (insert record + enqueue sync).
 * Local IDs are generated with expo-crypto randomUUID().
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { LOCAL_DB_SCHEMA, LOCAL_DB_VERSION } from './local-db-schema';

// ─── Types ───────────────────────────────────────────────────────────────────

type SyncStatus = 'synced' | 'pending' | 'error';

export type LocalGroup = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_by: string;
  avatar_url: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
  _sync_status: SyncStatus;
  _local_id: string | null;
  _last_synced_at: string | null;
};

export type LocalGroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  is_active: number;
  _sync_status: SyncStatus;
  _local_id: string | null;
  _last_synced_at: string | null;
};

export type LocalExpense = {
  id: string;
  group_id: string | null;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  category: string | null;
  split_type: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  _sync_status: SyncStatus;
  _local_id: string | null;
  _last_synced_at: string | null;
};

export type LocalExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  percentage: number | null;
  settled: number;
  created_at: string;
  _sync_status: SyncStatus;
  _local_id: string | null;
  _last_synced_at: string | null;
};

export type LocalSettlement = {
  id: string;
  group_id: string | null;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  status: string;
  note: string | null;
  upi_transaction_id: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  _sync_status: SyncStatus;
  _local_id: string | null;
  _last_synced_at: string | null;
};

export type LocalActivity = {
  id: string;
  group_id: string | null;
  actor_id: string;
  type: string;
  title: string;
  description: string;
  metadata: string | null;
  created_at: string;
  _sync_status: SyncStatus;
};

export type SyncQueueEntry = {
  id: number;
  operation: 'create' | 'update' | 'delete';
  table_name: string;
  record_id: string;
  payload: string;
  created_at: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  status: 'pending' | 'in_progress' | 'failed' | 'completed';
};

export type SyncConflict = {
  id: number;
  table_name: string;
  record_id: string;
  local_data: string;
  server_data: string;
  resolution: string;
  resolved_at: string;
  acknowledged: number;
};

// ─── Insert types (omit auto-generated fields) ──────────────────────────────

export type LocalGroupInsert = {
  name: string;
  description?: string | null;
  currency?: string;
  avatar_url?: string | null;
};

export type LocalExpenseInsert = {
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  category?: string | null;
  split_type: string;
  notes?: string | null;
};

export type LocalExpenseSplitInsert = {
  user_id: string;
  amount: number;
  percentage?: number | null;
};

export type LocalSettlementInsert = {
  group_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  note?: string | null;
  payment_method?: string | null;
};

export type SyncOperationInsert = {
  operation: 'create' | 'update' | 'delete';
  table_name: string;
  record_id: string;
  payload: Record<string, unknown>;
};

// ─── Database singleton ──────────────────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

export async function initLocalDb(): Promise<void> {
  db = await SQLite.openDatabaseAsync('hisabkitab.db');

  // Enable WAL mode for crash safety and better concurrent read performance
  await db.execAsync('PRAGMA journal_mode=WAL;');

  // Create all tables and indexes
  await db.execAsync(LOCAL_DB_SCHEMA);

  // Store schema version in sync_metadata
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('db_version', ?)`,
    [String(LOCAL_DB_VERSION)],
  );
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Local DB not initialized. Call initLocalDb() first.');
  }
  return db;
}

// ─── Helper: current ISO timestamp ──────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function getLocalGroups(userId: string): Promise<LocalGroup[]> {
  const database = getDb();
  return database.getAllAsync<LocalGroup>(
    `SELECT g.* FROM local_groups g
     INNER JOIN local_group_members m ON m.group_id = g.id
     WHERE m.user_id = ? AND m.is_active = 1 AND g.is_archived = 0
     ORDER BY g.updated_at DESC`,
    [userId],
  );
}

export async function getLocalGroupById(
  groupId: string,
): Promise<{ group: LocalGroup; members: LocalGroupMember[] } | null> {
  const database = getDb();

  const group = await database.getFirstAsync<LocalGroup>(
    `SELECT * FROM local_groups WHERE id = ?`,
    [groupId],
  );

  if (!group) return null;

  const members = await database.getAllAsync<LocalGroupMember>(
    `SELECT * FROM local_group_members WHERE group_id = ? AND is_active = 1`,
    [groupId],
  );

  return { group, members };
}

export async function insertLocalGroup(
  groupData: LocalGroupInsert,
  userId: string,
): Promise<string> {
  const database = getDb();
  const groupId = Crypto.randomUUID();
  const memberId = Crypto.randomUUID();
  const now = nowISO();

  await database.withTransactionAsync(async () => {
    // Insert group
    await database.runAsync(
      `INSERT INTO local_groups (id, name, description, currency, created_by, avatar_url, created_at, updated_at, _sync_status, _local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        groupId,
        groupData.name,
        groupData.description ?? null,
        groupData.currency ?? 'INR',
        userId,
        groupData.avatar_url ?? null,
        now,
        now,
        groupId,
      ],
    );

    // Add creator as admin member
    await database.runAsync(
      `INSERT INTO local_group_members (id, group_id, user_id, role, joined_at, is_active, _sync_status, _local_id)
       VALUES (?, ?, ?, 'admin', ?, 1, 'pending', ?)`,
      [memberId, groupId, userId, now, memberId],
    );

    // Enqueue sync for group creation
    await database.runAsync(
      `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
       VALUES ('create', 'groups', ?, ?, ?)`,
      [
        groupId,
        JSON.stringify({
          name: groupData.name,
          description: groupData.description ?? null,
          currency: groupData.currency ?? 'INR',
          avatar_url: groupData.avatar_url ?? null,
        }),
        now,
      ],
    );

    // Enqueue sync for member creation
    await database.runAsync(
      `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
       VALUES ('create', 'group_members', ?, ?, ?)`,
      [
        memberId,
        JSON.stringify({
          group_id: groupId,
          user_id: userId,
          role: 'admin',
        }),
        now,
      ],
    );
  });

  return groupId;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function getLocalExpenses(groupId: string): Promise<LocalExpense[]> {
  const database = getDb();
  return database.getAllAsync<LocalExpense>(
    `SELECT * FROM local_expenses WHERE group_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [groupId],
  );
}

export async function getLocalExpenseWithSplits(
  expenseId: string,
): Promise<{ expense: LocalExpense; splits: LocalExpenseSplit[] } | null> {
  const database = getDb();

  const expense = await database.getFirstAsync<LocalExpense>(
    `SELECT * FROM local_expenses WHERE id = ?`,
    [expenseId],
  );

  if (!expense) return null;

  const splits = await database.getAllAsync<LocalExpenseSplit>(
    `SELECT * FROM local_expense_splits WHERE expense_id = ?`,
    [expenseId],
  );

  return { expense, splits };
}

export async function insertLocalExpense(
  expenseData: LocalExpenseInsert,
  splits: LocalExpenseSplitInsert[],
  userId: string,
): Promise<string> {
  const database = getDb();
  const expenseId = Crypto.randomUUID();
  const now = nowISO();

  await database.withTransactionAsync(async () => {
    // Insert expense
    await database.runAsync(
      `INSERT INTO local_expenses (id, group_id, description, amount, currency, paid_by, category, split_type, notes, created_by, created_at, updated_at, _sync_status, _local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        expenseId,
        expenseData.group_id,
        expenseData.description,
        expenseData.amount,
        expenseData.currency,
        expenseData.paid_by,
        expenseData.category ?? null,
        expenseData.split_type,
        expenseData.notes ?? null,
        userId,
        now,
        now,
        expenseId,
      ],
    );

    // Insert splits
    const splitRecords: Array<{ id: string; user_id: string; amount: number; percentage: number | null }> = [];
    for (const split of splits) {
      const splitId = Crypto.randomUUID();
      splitRecords.push({
        id: splitId,
        user_id: split.user_id,
        amount: split.amount,
        percentage: split.percentage ?? null,
      });

      await database.runAsync(
        `INSERT INTO local_expense_splits (id, expense_id, user_id, amount, percentage, created_at, _sync_status, _local_id)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          splitId,
          expenseId,
          split.user_id,
          split.amount,
          split.percentage ?? null,
          now,
          splitId,
        ],
      );
    }

    // Enqueue sync for expense
    await database.runAsync(
      `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
       VALUES ('create', 'expenses', ?, ?, ?)`,
      [
        expenseId,
        JSON.stringify({
          group_id: expenseData.group_id,
          description: expenseData.description,
          amount: expenseData.amount,
          currency: expenseData.currency,
          paid_by: expenseData.paid_by,
          category: expenseData.category ?? null,
          split_type: expenseData.split_type,
          notes: expenseData.notes ?? null,
          splits: splitRecords.map((s) => ({
            user_id: s.user_id,
            amount: s.amount,
            percentage: s.percentage,
          })),
        }),
        now,
      ],
    );
  });

  return expenseId;
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export async function getLocalSettlements(groupId: string): Promise<LocalSettlement[]> {
  const database = getDb();
  return database.getAllAsync<LocalSettlement>(
    `SELECT * FROM local_settlements WHERE group_id = ? ORDER BY created_at DESC`,
    [groupId],
  );
}

export async function insertLocalSettlement(
  settlementData: LocalSettlementInsert,
  userId: string,
): Promise<string> {
  const database = getDb();
  const settlementId = Crypto.randomUUID();
  const now = nowISO();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO local_settlements (id, group_id, payer_id, payee_id, amount, currency, status, note, payment_method, created_at, updated_at, _sync_status, _local_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'pending', ?)`,
      [
        settlementId,
        settlementData.group_id,
        settlementData.payer_id,
        settlementData.payee_id,
        settlementData.amount,
        settlementData.currency,
        settlementData.note ?? null,
        settlementData.payment_method ?? null,
        now,
        now,
        settlementId,
      ],
    );

    // Enqueue sync
    await database.runAsync(
      `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
       VALUES ('create', 'settlements', ?, ?, ?)`,
      [
        settlementId,
        JSON.stringify({
          group_id: settlementData.group_id,
          payer_id: settlementData.payer_id,
          payee_id: settlementData.payee_id,
          amount: settlementData.amount,
          currency: settlementData.currency,
          note: settlementData.note ?? null,
          payment_method: settlementData.payment_method ?? null,
        }),
        now,
      ],
    );
  });

  return settlementId;
}

// ─── Activity Log ────────────────────────────────────────────────────────────

export async function getLocalActivity(userId: string): Promise<LocalActivity[]> {
  const database = getDb();
  return database.getAllAsync<LocalActivity>(
    `SELECT a.* FROM local_activity_log a
     INNER JOIN local_group_members m ON m.group_id = a.group_id
     WHERE m.user_id = ? AND m.is_active = 1
     ORDER BY a.created_at DESC
     LIMIT 100`,
    [userId],
  );
}

// ─── Sync Queue Operations ──────────────────────────────────────────────────

export async function enqueueSyncOperation(op: SyncOperationInsert): Promise<void> {
  const database = getDb();
  await database.runAsync(
    `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [op.operation, op.table_name, op.record_id, JSON.stringify(op.payload), nowISO()],
  );
}

export async function getPendingSyncOps(): Promise<SyncQueueEntry[]> {
  const database = getDb();
  return database.getAllAsync<SyncQueueEntry>(
    `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 10`,
  );
}

export async function markSyncOpCompleted(id: number): Promise<void> {
  const database = getDb();
  await database.runAsync(
    `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
    [id],
  );
}

export async function markSyncOpFailed(id: number, error: string): Promise<void> {
  const database = getDb();
  await database.runAsync(
    `UPDATE sync_queue SET
       retry_count = retry_count + 1,
       last_error = ?,
       status = CASE
         WHEN retry_count + 1 >= max_retries THEN 'failed'
         ELSE 'pending'
       END
     WHERE id = ?`,
    [error, id],
  );
}

export async function updateRecordSyncStatus(
  table: string,
  id: string,
  status: SyncStatus,
): Promise<void> {
  const database = getDb();
  // Validate table name to prevent SQL injection (only allow known local_ tables)
  const allowedTables = [
    'local_groups',
    'local_group_members',
    'local_expenses',
    'local_expense_splits',
    'local_settlements',
    'local_activity_log',
  ];
  const fullTable = table.startsWith('local_') ? table : `local_${table}`;
  if (!allowedTables.includes(fullTable)) {
    throw new Error(`Invalid table name for sync status update: ${table}`);
  }

  await database.runAsync(
    `UPDATE ${fullTable} SET _sync_status = ?, _last_synced_at = ? WHERE id = ?`,
    [status, nowISO(), id],
  );
}

// ─── Sync Conflicts ─────────────────────────────────────────────────────────

export async function getUnacknowledgedConflicts(): Promise<SyncConflict[]> {
  const database = getDb();
  return database.getAllAsync<SyncConflict>(
    `SELECT * FROM sync_conflicts WHERE acknowledged = 0 ORDER BY resolved_at DESC`,
  );
}

export async function acknowledgeConflict(id: number): Promise<void> {
  const database = getDb();
  await database.runAsync(
    `UPDATE sync_conflicts SET acknowledged = 1 WHERE id = ?`,
    [id],
  );
}

// ─── Pending count (for UI indicator) ────────────────────────────────────────

export async function getPendingSyncCount(): Promise<number> {
  const database = getDb();
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`,
  );
  return result?.count ?? 0;
}
