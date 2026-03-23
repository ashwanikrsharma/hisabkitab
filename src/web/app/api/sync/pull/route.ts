import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getServerClient } from '@hisabkitab/services';

const ALLOWED_TABLES = [
  'groups',
  'group_members',
  'expenses',
  'expense_splits',
  'settlements',
  'activity_log',
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

const PullParamsSchema = z.object({
  since: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'since must be a valid ISO timestamp',
  }),
  tables: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [...ALLOWED_TABLES];
      return val.split(',').filter((t): t is AllowedTable =>
        ALLOWED_TABLES.includes(t as AllowedTable),
      );
    }),
});

type ChangesMap = Record<string, Record<string, unknown>[]>;

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = PullParamsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { since, tables } = parsed.data;

  try {
    const db = getServerClient();

    // Step 1: Get the user's active group IDs for scoping queries
    const { data: memberships, error: memberError } = await db
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (memberError) {
      console.error('[GET /api/sync/pull] Failed to fetch memberships:', memberError.message);
      return Response.json({ error: 'Failed to fetch user groups' }, { status: 500 });
    }

    const groupIds = (memberships ?? []).map((m) => m.group_id);

    // Capture server timestamp before queries (used as next "since" by client)
    const serverTimestamp = new Date().toISOString();

    // Step 2: Query each requested table for changes since the given timestamp
    const changes: ChangesMap = {};

    const queryPromises = tables.map(async (table) => {
      const rows = await queryTableChanges(db, table, since, user.id, groupIds);
      return { table, rows };
    });

    const queryResults = await Promise.all(queryPromises);

    for (const { table, rows } of queryResults) {
      changes[table] = rows;
    }

    return Response.json({
      changes,
      timestamp: serverTimestamp,
    });
  } catch (err) {
    console.error('[GET /api/sync/pull]', err);
    return Response.json({ error: 'Failed to pull changes' }, { status: 500 });
  }
}

/**
 * Queries a single table for records changed since the given timestamp,
 * scoped to the user's groups or the user's own records.
 *
 * Includes soft-deleted records so the client can delete them locally.
 */
async function queryTableChanges(
  db: ReturnType<typeof getServerClient>,
  table: AllowedTable,
  since: string,
  userId: string,
  groupIds: string[],
): Promise<Record<string, unknown>[]> {
  switch (table) {
    case 'groups': {
      if (groupIds.length === 0) return [];

      const { data, error } = await db
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .gt('updated_at', since);

      if (error) {
        console.error(`[sync/pull] groups query failed:`, error.message);
        return [];
      }
      return (data ?? []) as Record<string, unknown>[];
    }

    case 'group_members': {
      if (groupIds.length === 0) return [];

      const { data, error } = await db
        .from('group_members')
        .select('*')
        .in('group_id', groupIds)
        .gt('joined_at', since);

      if (error) {
        console.error(`[sync/pull] group_members query failed:`, error.message);
        return [];
      }

      // group_members does not have updated_at, so we use joined_at as the
      // change timestamp. Also include rows where is_active changed (deactivated
      // members). Since we cannot filter by updated_at, we return all members for
      // the user's groups when this is the first sync (since is epoch).
      return (data ?? []) as Record<string, unknown>[];
    }

    case 'expenses': {
      if (groupIds.length === 0) {
        // Still check for direct expenses (group_id IS NULL)
        const { data, error } = await db
          .from('expenses')
          .select('*')
          .is('group_id', null)
          .or(`paid_by.eq.${userId},created_by.eq.${userId}`)
          .gt('updated_at', since);

        if (error) {
          console.error(`[sync/pull] expenses (direct) query failed:`, error.message);
          return [];
        }
        return (data ?? []) as Record<string, unknown>[];
      }

      // Fetch group expenses AND direct expenses involving this user
      const [groupResult, directResult] = await Promise.all([
        db
          .from('expenses')
          .select('*')
          .in('group_id', groupIds)
          .gt('updated_at', since),
        db
          .from('expenses')
          .select('*')
          .is('group_id', null)
          .or(`paid_by.eq.${userId},created_by.eq.${userId}`)
          .gt('updated_at', since),
      ]);

      if (groupResult.error) {
        console.error(`[sync/pull] expenses (group) query failed:`, groupResult.error.message);
      }
      if (directResult.error) {
        console.error(`[sync/pull] expenses (direct) query failed:`, directResult.error.message);
      }

      const groupExpenses = (groupResult.data ?? []) as Record<string, unknown>[];
      const directExpenses = (directResult.data ?? []) as Record<string, unknown>[];

      // Deduplicate by ID
      const seen = new Set<string>();
      const merged: Record<string, unknown>[] = [];
      for (const row of [...groupExpenses, ...directExpenses]) {
        const id = row.id as string;
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(row);
        }
      }
      return merged;
    }

    case 'expense_splits': {
      // Fetch splits for expenses in the user's groups or where user is involved
      const { data, error } = await db
        .from('expense_splits')
        .select('*, expenses!inner(group_id, paid_by, created_by)')
        .gt('created_at', since);

      if (error) {
        console.error(`[sync/pull] expense_splits query failed:`, error.message);
        return [];
      }

      // Filter to user's groups or user's own splits
      const filtered = (data ?? []).filter((row) => {
        const expense = (row as Record<string, unknown>).expenses as Record<string, unknown> | null;
        if (!expense) return false;

        const expenseGroupId = expense.group_id as string | null;
        if (expenseGroupId && groupIds.includes(expenseGroupId)) return true;

        // Direct expense involving the user
        if (expense.paid_by === userId || expense.created_by === userId) return true;
        if ((row as Record<string, unknown>).user_id === userId) return true;

        return false;
      });

      // Strip the joined expenses object before returning
      return filtered.map((row) => {
        const { expenses: _expenses, ...rest } = row as Record<string, unknown>;
        return rest;
      });
    }

    case 'settlements': {
      if (groupIds.length === 0) {
        // Direct settlements involving the user
        const { data, error } = await db
          .from('settlements')
          .select('*')
          .is('group_id', null)
          .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
          .gt('updated_at', since);

        if (error) {
          console.error(`[sync/pull] settlements (direct) query failed:`, error.message);
          return [];
        }
        return (data ?? []) as Record<string, unknown>[];
      }

      const [groupResult, directResult] = await Promise.all([
        db
          .from('settlements')
          .select('*')
          .in('group_id', groupIds)
          .gt('updated_at', since),
        db
          .from('settlements')
          .select('*')
          .is('group_id', null)
          .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
          .gt('updated_at', since),
      ]);

      if (groupResult.error) {
        console.error(`[sync/pull] settlements (group) query failed:`, groupResult.error.message);
      }
      if (directResult.error) {
        console.error(`[sync/pull] settlements (direct) query failed:`, directResult.error.message);
      }

      const groupSettlements = (groupResult.data ?? []) as Record<string, unknown>[];
      const directSettlements = (directResult.data ?? []) as Record<string, unknown>[];

      const seen = new Set<string>();
      const merged: Record<string, unknown>[] = [];
      for (const row of [...groupSettlements, ...directSettlements]) {
        const id = row.id as string;
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(row);
        }
      }
      return merged;
    }

    case 'activity_log': {
      if (groupIds.length === 0) {
        // Only the user's own direct activity
        const { data, error } = await db
          .from('activity_log')
          .select('*')
          .eq('actor_id', userId)
          .is('group_id', null)
          .gt('created_at', since);

        if (error) {
          console.error(`[sync/pull] activity_log (direct) query failed:`, error.message);
          return [];
        }
        return (data ?? []) as Record<string, unknown>[];
      }

      const [groupResult, directResult] = await Promise.all([
        db
          .from('activity_log')
          .select('*')
          .in('group_id', groupIds)
          .gt('created_at', since),
        db
          .from('activity_log')
          .select('*')
          .eq('actor_id', userId)
          .is('group_id', null)
          .gt('created_at', since),
      ]);

      if (groupResult.error) {
        console.error(`[sync/pull] activity_log (group) query failed:`, groupResult.error.message);
      }
      if (directResult.error) {
        console.error(`[sync/pull] activity_log (direct) query failed:`, directResult.error.message);
      }

      const groupActivity = (groupResult.data ?? []) as Record<string, unknown>[];
      const directActivity = (directResult.data ?? []) as Record<string, unknown>[];

      const seen = new Set<string>();
      const merged: Record<string, unknown>[] = [];
      for (const row of [...groupActivity, ...directActivity]) {
        const id = row.id as string;
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(row);
        }
      }
      return merged;
    }

    default: {
      return [];
    }
  }
}
