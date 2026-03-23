/**
 * Sync engine: orchestrates push/pull between local SQLite and the server.
 *
 * Triggers:
 * - App comes to foreground (AppState change)
 * - Device reconnects to network (NetInfo event)
 * - 30-second interval timer (only while online)
 * - Manual call to triggerSync()
 *
 * Push: reads pending operations from sync_queue, POSTs to /api/sync/push
 * Pull: fetches changes since last_pull_timestamp from /api/sync/pull
 */

import { AppState } from 'react-native';
import Constants from 'expo-constants';
import {
  getPendingSyncOps,
  markSyncOpCompleted,
  markSyncOpFailed,
  getDb,
  type SyncQueueEntry,
} from './local-db';
import { isOnline, subscribeToNetworkStatus } from './network-status';
import { supabase } from '../store/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

type PushResult = {
  queue_id: string;
  status: 'ok' | 'conflict' | 'error';
  server_id?: string;
  server_data?: Record<string, unknown>;
  error?: string;
};

// ─── State ───────────────────────────────────────────────────────────────────

let _status: SyncStatus = 'idle';
let _timer: ReturnType<typeof setInterval> | null = null;
let _syncInProgress = false;

const SYNC_INTERVAL_MS = 30_000;

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://hisabkitab-five.vercel.app';

// ─── Public API ──────────────────────────────────────────────────────────────

export function getSyncStatus(): SyncStatus {
  return _status;
}

/**
 * Trigger a full push+pull sync cycle.
 * No-op if already syncing or offline.
 */
export async function triggerSync(): Promise<void> {
  if (_syncInProgress || !isOnline()) return;

  _syncInProgress = true;
  _status = 'syncing';

  try {
    await pushPendingOps();
    await pullChanges();
    _status = 'idle';
  } catch (err) {
    console.error('[sync-engine] sync failed:', err);
    _status = 'error';
  } finally {
    _syncInProgress = false;
  }
}

/**
 * Start the sync engine. Returns a cleanup function to stop it.
 *
 * Sets up three triggers:
 * 1. AppState listener (sync on foreground)
 * 2. Network reconnect listener
 * 3. 30-second interval timer
 */
export function startSyncEngine(): () => void {
  // Trigger sync on app foreground
  const appStateListener = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      triggerSync().catch((err) =>
        console.error('[sync-engine] foreground sync error:', err),
      );
    }
  });

  // Trigger sync on network reconnect
  const unsubNet = subscribeToNetworkStatus(
    () => {
      triggerSync().catch((err) =>
        console.error('[sync-engine] reconnect sync error:', err),
      );
    },
    () => {
      // Offline -- no action needed
    },
  );

  // 30-second interval timer
  _timer = setInterval(() => {
    if (isOnline()) {
      triggerSync().catch((err) =>
        console.error('[sync-engine] timer sync error:', err),
      );
    }
  }, SYNC_INTERVAL_MS);

  // Initial sync
  triggerSync().catch((err) =>
    console.error('[sync-engine] initial sync error:', err),
  );

  return () => {
    appStateListener.remove();
    unsubNet();
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  };
}

// ─── Push: Client to Server ─────────────────────────────────────────────────

async function pushPendingOps(): Promise<void> {
  const ops = await getPendingSyncOps();
  if (ops.length === 0) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) return; // Not logged in -- skip push

  const res = await fetch(`${API_URL}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      device_id: 'mobile',
      operations: ops.map((op) => ({
        id: String(op.id),
        operation: op.operation,
        table: op.table_name,
        record_id: op.record_id,
        data: safeJsonParse(op.payload),
        client_updated_at: op.created_at,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Push failed: ${res.status}`);
  }

  const body = await res.json() as { results: PushResult[] };
  const { results } = body;
  const database = getDb();

  await database.withTransactionAsync(async () => {
    for (const result of results) {
      if (result.status === 'ok') {
        await markSyncOpCompleted(Number(result.queue_id));

        // Update server ID if provided (for creates)
        if (result.server_id) {
          const op = ops.find((o) => String(o.id) === result.queue_id);
          if (op) {
            await updateLocalRecordWithServerId(database, op, result.server_id);
          }
        }
      } else if (result.status === 'conflict') {
        await handleConflict(database, ops, result);
        await markSyncOpCompleted(Number(result.queue_id));
      } else {
        await markSyncOpFailed(
          Number(result.queue_id),
          result.error ?? 'Unknown error',
        );
      }
    }
  });
}

async function updateLocalRecordWithServerId(
  database: ReturnType<typeof getDb>,
  op: SyncQueueEntry,
  serverId: string,
): Promise<void> {
  const tableName = `local_${op.table_name}`;
  const allowedTables = [
    'local_groups',
    'local_group_members',
    'local_expenses',
    'local_expense_splits',
    'local_settlements',
    'local_activity_log',
  ];

  if (!allowedTables.includes(tableName)) return;

  await database.runAsync(
    `UPDATE ${tableName} SET id = ?, _sync_status = 'synced', _local_id = ? WHERE id = ?`,
    [serverId, op.record_id, op.record_id],
  );
}

async function handleConflict(
  database: ReturnType<typeof getDb>,
  ops: SyncQueueEntry[],
  result: PushResult,
): Promise<void> {
  const op = ops.find((o) => String(o.id) === result.queue_id);
  if (!op) return;

  await database.runAsync(
    `INSERT INTO sync_conflicts (table_name, record_id, local_data, server_data, resolution, resolved_at)
     VALUES (?, ?, ?, ?, 'server_wins', datetime('now'))`,
    [
      op.table_name,
      op.record_id,
      op.payload,
      JSON.stringify(result.server_data ?? {}),
    ],
  );
}

// ─── Pull: Server to Client ─────────────────────────────────────────────────

async function pullChanges(): Promise<void> {
  const database = getDb();

  const lastPull = await database.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_metadata WHERE key = 'last_pull_timestamp'`,
  );
  const since = lastPull?.value ?? new Date(0).toISOString();

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) return;

  const res = await fetch(
    `${API_URL}/api/sync/pull?since=${encodeURIComponent(since)}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Pull failed: ${res.status}`);
  }

  const body = await res.json() as {
    changes: Record<string, Array<Record<string, unknown>>>;
    timestamp: string;
  };
  const { changes, timestamp } = body;

  await database.withTransactionAsync(async () => {
    for (const [table, records] of Object.entries(changes)) {
      for (const record of records) {
        await upsertLocalRecord(database, table, record);
      }
    }

    // Update last pull timestamp
    await database.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_pull_timestamp', ?)`,
      [timestamp],
    );
  });
}

/**
 * Upsert a server record into the local database.
 *
 * Rules:
 * 1. If a local record exists with _sync_status = 'pending', skip it (local changes
 *    take priority until they are pushed).
 * 2. Otherwise, INSERT OR REPLACE with _sync_status = 'synced'.
 */
async function upsertLocalRecord(
  database: ReturnType<typeof getDb>,
  table: string,
  record: Record<string, unknown>,
): Promise<void> {
  const tableName = `local_${table}`;
  const allowedTables: Record<string, string[]> = {
    local_users: ['id', 'phone', 'name', 'avatar_url', 'upi_id', 'default_currency', 'created_at', 'updated_at'],
    local_groups: ['id', 'name', 'description', 'currency', 'created_by', 'avatar_url', 'is_archived', 'created_at', 'updated_at'],
    local_group_members: ['id', 'group_id', 'user_id', 'role', 'joined_at', 'is_active'],
    local_expenses: ['id', 'group_id', 'description', 'amount', 'currency', 'paid_by', 'category', 'split_type', 'receipt_url', 'notes', 'created_by', 'created_at', 'updated_at', 'deleted_at'],
    local_expense_splits: ['id', 'expense_id', 'user_id', 'amount', 'percentage', 'settled', 'created_at'],
    local_settlements: ['id', 'group_id', 'payer_id', 'payee_id', 'amount', 'currency', 'status', 'note', 'upi_transaction_id', 'payment_method', 'created_at', 'updated_at'],
    local_activity_log: ['id', 'group_id', 'actor_id', 'type', 'title', 'description', 'metadata', 'created_at'],
  };

  const columns = allowedTables[tableName];
  if (!columns) return; // Unknown table -- skip

  const recordId = record.id as string | undefined;
  if (!recordId) return; // No ID -- skip

  // Check if local record exists with pending changes
  const existing = await database.getFirstAsync<{ _sync_status: string }>(
    `SELECT _sync_status FROM ${tableName} WHERE id = ?`,
    [recordId],
  );

  if (existing && existing._sync_status === 'pending') {
    // Local changes take priority until pushed -- skip server update
    return;
  }

  // Build INSERT OR REPLACE with only known columns + sync metadata
  const insertColumns = [...columns, '_sync_status', '_last_synced_at'];
  const placeholders = insertColumns.map(() => '?').join(', ');
  const values = [
    ...columns.map((col) => {
      const val = record[col];
      if (val === undefined || val === null) return null;
      // Convert objects/arrays to JSON strings for TEXT columns
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    }),
    'synced',
    new Date().toISOString(),
  ];

  await database.runAsync(
    `INSERT OR REPLACE INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`,
    values as Array<string | number | null>,
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}
