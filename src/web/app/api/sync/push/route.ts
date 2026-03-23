import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getServerClient, createActivity } from '@hisabkitab/services';

const ALLOWED_TABLES = [
  'groups',
  'group_members',
  'expenses',
  'expense_splits',
  'settlements',
  'activity_log',
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

const SyncOperationSchema = z.object({
  id: z.string(), // queue entry ID for idempotency
  operation: z.enum(['create', 'update', 'delete']),
  table: z.enum(ALLOWED_TABLES),
  record_id: z.string(),
  data: z.record(z.unknown()),
  client_updated_at: z.string(),
});

const SyncPushSchema = z.object({
  device_id: z.string(),
  operations: z.array(SyncOperationSchema).max(50),
});

type SyncOperation = z.infer<typeof SyncOperationSchema>;

type OperationResult = {
  queue_id: string;
  status: 'ok' | 'conflict' | 'error';
  server_id?: string;
  server_data?: Record<string, unknown>;
  error?: string;
};

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);
  const parsed = SyncPushSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { operations } = parsed.data;
  const results: OperationResult[] = [];

  for (const op of operations) {
    try {
      const result = await processOperation(op, user.id);
      results.push(result);
    } catch (err) {
      console.error(`[POST /api/sync/push] op=${op.id} table=${op.table}`, err);
      results.push({
        queue_id: op.id,
        status: 'error',
        error: 'Failed to process operation',
      });
    }
  }

  // Log sync activity (non-blocking)
  const successCount = results.filter((r) => r.status === 'ok').length;
  const conflictCount = results.filter((r) => r.status === 'conflict').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  if (successCount > 0) {
    createActivity({
      actorId: user.id,
      type: 'expense_added', // closest existing type for sync
      title: 'Sync push',
      description: `Synced ${successCount} operations (${conflictCount} conflicts, ${errorCount} errors)`,
      metadata: {
        device_id: parsed.data.device_id,
        success_count: successCount,
        conflict_count: conflictCount,
        error_count: errorCount,
      },
    }).catch((err) => console.error('[activity sync_push]', err));
  }

  return Response.json({ results });
}

/**
 * Processes a single sync operation against the database.
 * Uses service-role client (RLS bypassed) since requireAuth already verified the user.
 */
async function processOperation(
  op: SyncOperation,
  userId: string,
): Promise<OperationResult> {
  const db = getServerClient();
  const table = op.table as AllowedTable;

  switch (op.operation) {
    case 'create': {
      return await handleCreate(db, table, op, userId);
    }
    case 'update': {
      return await handleUpdate(db, table, op);
    }
    case 'delete': {
      return await handleDelete(db, table, op);
    }
    default: {
      return {
        queue_id: op.id,
        status: 'error',
        error: 'Unknown operation type',
      };
    }
  }
}

/**
 * Handles a create operation. Checks for existing record (idempotency)
 * before inserting.
 */
async function handleCreate(
  db: ReturnType<typeof getServerClient>,
  table: AllowedTable,
  op: SyncOperation,
  _userId: string,
): Promise<OperationResult> {
  // Idempotency check: see if a record with this ID already exists
  const { data: existing } = await db
    .from(table)
    .select('*')
    .eq('id', op.record_id)
    .maybeSingle();

  if (existing) {
    // Record already exists -- return existing ID (idempotent)
    return {
      queue_id: op.id,
      status: 'ok',
      server_id: (existing as Record<string, unknown>).id as string,
      server_data: existing as Record<string, unknown>,
    };
  }

  // Strip sync-only client fields before inserting
  const insertData = sanitizeDataForInsert(op.data, op.record_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic sync across all tables
  const { data: inserted, error } = await (db
    .from(table) as any)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error(`[sync/push] create failed on ${table}:`, error.message);
    return {
      queue_id: op.id,
      status: 'error',
      error: 'Failed to create record',
    };
  }

  return {
    queue_id: op.id,
    status: 'ok',
    server_id: (inserted as Record<string, unknown>).id as string,
    server_data: inserted as Record<string, unknown>,
  };
}

/**
 * Handles an update operation with LWW conflict detection.
 * Compares client_updated_at with the server's updated_at.
 */
async function handleUpdate(
  db: ReturnType<typeof getServerClient>,
  table: AllowedTable,
  op: SyncOperation,
): Promise<OperationResult> {
  // Fetch current server version
  const { data: serverRecord, error: fetchError } = await db
    .from(table)
    .select('*')
    .eq('id', op.record_id)
    .maybeSingle();

  if (fetchError) {
    console.error(`[sync/push] update fetch failed on ${table}:`, fetchError.message);
    return {
      queue_id: op.id,
      status: 'error',
      error: 'Failed to fetch record for update',
    };
  }

  if (!serverRecord) {
    return {
      queue_id: op.id,
      status: 'error',
      error: 'Record not found',
    };
  }

  const serverData = serverRecord as Record<string, unknown>;
  const serverUpdatedAt = serverData.updated_at as string | undefined;

  // LWW conflict detection: if server record has updated_at and it's newer than client's,
  // return conflict with server data
  if (serverUpdatedAt && op.client_updated_at) {
    const serverTime = new Date(serverUpdatedAt).getTime();
    const clientTime = new Date(op.client_updated_at).getTime();

    if (serverTime > clientTime) {
      return {
        queue_id: op.id,
        status: 'conflict',
        server_id: serverData.id as string,
        server_data: serverData,
      };
    }
  }

  // Client wins (or equal) -- apply update
  const updateData = sanitizeDataForUpdate(op.data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic sync across all tables
  const { data: updated, error: updateError } = await (db
    .from(table) as any)
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', op.record_id)
    .select()
    .single();

  if (updateError) {
    console.error(`[sync/push] update failed on ${table}:`, updateError.message);
    return {
      queue_id: op.id,
      status: 'error',
      error: 'Failed to update record',
    };
  }

  return {
    queue_id: op.id,
    status: 'ok',
    server_id: (updated as Record<string, unknown>).id as string,
    server_data: updated as Record<string, unknown>,
  };
}

/**
 * Handles a delete operation via soft-delete (sets deleted_at).
 * For tables without deleted_at, performs a hard delete.
 */
async function handleDelete(
  db: ReturnType<typeof getServerClient>,
  table: AllowedTable,
  op: SyncOperation,
): Promise<OperationResult> {
  // Tables that support soft-delete via deleted_at column
  const softDeleteTables: AllowedTable[] = ['expenses'];

  if (softDeleteTables.includes(table)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic sync across all tables
    const { error } = await (db
      .from(table) as any)
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', op.record_id);

    if (error) {
      console.error(`[sync/push] soft-delete failed on ${table}:`, error.message);
      return {
        queue_id: op.id,
        status: 'error',
        error: 'Failed to delete record',
      };
    }
  } else {
    // For tables without deleted_at, set is_active = false or hard delete
    // group_members has is_active; other tables use hard delete
    if (table === 'group_members') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic sync across all tables
      const { error } = await (db
        .from(table) as any)
        .update({ is_active: false })
        .eq('id', op.record_id);

      if (error) {
        console.error(`[sync/push] deactivate failed on ${table}:`, error.message);
        return {
          queue_id: op.id,
          status: 'error',
          error: 'Failed to delete record',
        };
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic sync across all tables
      const { error } = await (db
        .from(table) as any)
        .delete()
        .eq('id', op.record_id);

      if (error) {
        console.error(`[sync/push] hard-delete failed on ${table}:`, error.message);
        return {
          queue_id: op.id,
          status: 'error',
          error: 'Failed to delete record',
        };
      }
    }
  }

  return {
    queue_id: op.id,
    status: 'ok',
  };
}

/**
 * Removes client-only sync fields from data before inserting into the database.
 * Ensures the record_id is used as the `id` field.
 */
function sanitizeDataForInsert(
  data: Record<string, unknown>,
  recordId: string,
): Record<string, unknown> {
  const cleaned = { ...data };
  // Remove client-only sync metadata fields
  delete cleaned._sync_status;
  delete cleaned._local_id;
  delete cleaned._last_synced_at;
  delete cleaned._updated_at_local;

  // Use the record_id as the server ID
  cleaned.id = recordId;

  return cleaned;
}

/**
 * Removes fields that should not be updated (id, created_at, client-only fields).
 */
function sanitizeDataForUpdate(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned = { ...data };
  // Remove immutable / client-only fields
  delete cleaned.id;
  delete cleaned.created_at;
  delete cleaned._sync_status;
  delete cleaned._local_id;
  delete cleaned._last_synced_at;
  delete cleaned._updated_at_local;

  return cleaned;
}
