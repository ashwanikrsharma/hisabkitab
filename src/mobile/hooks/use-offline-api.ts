/**
 * Offline-first API hooks.
 *
 * Read hooks query local SQLite. Write hooks insert locally, enqueue sync,
 * then trigger the sync engine. Return types match the original online hooks
 * so screens require no changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useAuthStore } from '../store/auth';
import {
  getLocalGroups,
  getLocalGroupById,
  insertLocalGroup,
  getLocalExpenses,
  insertLocalExpense,
  insertLocalSettlement,
  getLocalActivity,
  getDb,
} from '../lib/local-db';
import { triggerSync } from '../lib/sync-engine';
import { isOnline } from '../lib/network-status';
import { apiClient } from '../lib/api-client';

// Types are duplicated here (not imported from use-api) to avoid circular deps.
// use-api.ts re-exports hooks from this file, so importing types from it would
// create a circular reference.

type GroupListItem = {
  id: string;
  name: string;
  currency: string;
  memberCount: number;
  yourBalance: number;
};

type GroupMember = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  balance: number;
};

type GroupDetail = {
  id: string;
  name: string;
  currency: string;
  members: GroupMember[];
};

type ExpenseItem = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  created_at: string;
  paidByName: string;
  paidById?: string;
  splitType?: string;
};

type Debt = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  currency: string;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  actor_id: string;
  metadata: Record<string, unknown> | null;
  group_id?: string;
  group_name?: string;
  user_name?: string;
  created_at: string;
};

type UserProfile = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  upi_id?: string;
  default_currency?: string;
  avatar_url?: string;
};

type UserSearchResult = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

// ─── Helper: resolve user name from local DB ────────────────────────────────

async function getLocalUserName(userId: string): Promise<string> {
  try {
    const database = getDb();
    const user = await database.getFirstAsync<{ name: string }>(
      `SELECT name FROM local_users WHERE id = ?`,
      [userId],
    );
    return user?.name ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function getLocalUser(userId: string): Promise<UserProfile | null> {
  try {
    const database = getDb();
    const user = await database.getFirstAsync<{
      id: string;
      name: string;
      phone: string | null;
      upi_id: string | null;
      default_currency: string | null;
      avatar_url: string | null;
    }>(
      `SELECT id, name, phone, upi_id, default_currency, avatar_url FROM local_users WHERE id = ?`,
      [userId],
    );
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone ?? undefined,
      upi_id: user.upi_id ?? undefined,
      default_currency: user.default_currency ?? undefined,
      avatar_url: user.avatar_url ?? undefined,
    };
  } catch {
    return null;
  }
}

// ─── Helper: compute member count for a group ────────────────────────────────

async function getGroupMemberCount(groupId: string): Promise<number> {
  try {
    const database = getDb();
    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM local_group_members WHERE group_id = ? AND is_active = 1`,
      [groupId],
    );
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Helper: compute user balance in a group ─────────────────────────────────

async function computeUserBalance(groupId: string, userId: string): Promise<number> {
  try {
    const database = getDb();

    // Total paid by the user in this group
    const paidResult = await database.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(amount) as total FROM local_expenses
       WHERE group_id = ? AND paid_by = ? AND deleted_at IS NULL`,
      [groupId, userId],
    );
    const totalPaid = paidResult?.total ?? 0;

    // Total split amount owed by the user in this group
    const owedResult = await database.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(es.amount) as total FROM local_expense_splits es
       INNER JOIN local_expenses e ON e.id = es.expense_id
       WHERE e.group_id = ? AND es.user_id = ? AND e.deleted_at IS NULL`,
      [groupId, userId],
    );
    const totalOwed = owedResult?.total ?? 0;

    // Balance = what you paid - what you owe
    return totalPaid - totalOwed;
  } catch {
    return 0;
  }
}

// ─── Read Hooks ──────────────────────────────────────────────────────────────

export function useOfflineGroups() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  return useQuery<GroupListItem[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      if (!userId) return [];
      const localGroups = await getLocalGroups(userId);

      if (localGroups.length > 0) {
        const items: GroupListItem[] = await Promise.all(
          localGroups.map(async (g): Promise<GroupListItem> => {
            const memberCount = await getGroupMemberCount(g.id);
            const yourBalance = await computeUserBalance(g.id, userId);
            return {
              id: g.id,
              name: g.name,
              currency: g.currency,
              memberCount,
              yourBalance,
            };
          }),
        );
        return items;
      }

      // Fallback: fetch from server and seed local DB
      try {

        type Resp = {
          groups: Array<{
            id: string;
            name: string;
            currency: string;
            description?: string;
            created_by?: string;
            is_archived?: boolean;
            memberCount?: number;
            member_count?: number;
            yourBalance?: number;
            your_balance?: number;
            created_at?: string;
            updated_at?: string;
          }>;
        };
        const data = await apiClient<Resp>('/api/groups');
        const serverGroups = data.groups ?? [];

        if (serverGroups.length > 0) {
          const database = getDb();
          const now = new Date().toISOString();

          await database.withTransactionAsync(async () => {
            for (const g of serverGroups) {
              await database.runAsync(
                `INSERT OR REPLACE INTO local_groups (id, name, description, currency, created_by, avatar_url, is_archived, created_at, updated_at, _sync_status, _last_synced_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
                [
                  g.id, g.name, g.description ?? null, g.currency ?? 'INR',
                  g.created_by ?? userId, null, g.is_archived ? 1 : 0,
                  g.created_at ?? now, g.updated_at ?? now, now,
                ],
              );
              // Seed the current user as a member so getLocalGroups finds them
              await database.runAsync(
                `INSERT OR IGNORE INTO local_group_members (id, group_id, user_id, role, joined_at, is_active, _sync_status, _last_synced_at)
                 VALUES (?, ?, ?, 'member', ?, 1, 'synced', ?)`,
                [`${g.id}_${userId}`, g.id, userId, now, now],
              );
            }
          });

          return serverGroups.map((g): GroupListItem => ({
            id: g.id,
            name: g.name,
            currency: g.currency ?? 'INR',
            memberCount: g.memberCount ?? g.member_count ?? 0,
            yourBalance: g.yourBalance ?? g.your_balance ?? 0,
          }));
        }
      } catch {
        // Server fetch failed — return empty, will retry on next query
      }

      return [];
    },
    enabled: Boolean(userId),
  });
}

export function useOfflineGroupDetail(groupId: string) {
  return useQuery<GroupDetail>({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const result = await getLocalGroupById(groupId);
      if (result) {
        const members: GroupMember[] = await Promise.all(
          result.members.map(async (m): Promise<GroupMember> => {
            const name = await getLocalUserName(m.user_id);
            const balance = await computeUserBalance(groupId, m.user_id);
            return {
              id: m.user_id,
              name,
              balance,
            };
          }),
        );

        return {
          id: result.group.id,
          name: result.group.name,
          currency: result.group.currency,
          members,
        };
      }

      // Fallback: fetch from server and seed local DB
      try {
        type Resp = {
          group?: GroupDetail;
          id?: string;
          name?: string;
          currency?: string;
          members?: GroupMember[];
        };
        const data = await apiClient<Resp>(`/api/groups/${groupId}`);
        const g = data.group ?? (data as GroupDetail);
        const detail: GroupDetail = {
          id: g.id ?? groupId,
          name: g.name ?? '',
          currency: g.currency ?? 'INR',
          members: g.members ?? [],
        };

        // Seed group and members into local DB
        const database = getDb();
        const now = new Date().toISOString();
        await database.withTransactionAsync(async () => {
          await database.runAsync(
            `INSERT OR REPLACE INTO local_groups (id, name, description, currency, created_by, avatar_url, is_archived, created_at, updated_at, _sync_status, _last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'synced', ?)`,
            [detail.id, detail.name, null, detail.currency, '', null, now, now, now],
          );
          for (const m of detail.members) {
            await database.runAsync(
              `INSERT OR IGNORE INTO local_group_members (id, group_id, user_id, role, joined_at, is_active, _sync_status, _last_synced_at)
               VALUES (?, ?, ?, 'member', ?, 1, 'synced', ?)`,
              [`${detail.id}_${m.id}`, detail.id, m.id, now, now],
            );
            // Seed user name for future local lookups
            await database.runAsync(
              `INSERT OR IGNORE INTO local_users (id, name, created_at, updated_at, _sync_status, _last_synced_at)
               VALUES (?, ?, ?, ?, 'synced', ?)`,
              [m.id, m.name, now, now, now],
            );
          }
        });

        return detail;
      } catch {
        // Server fetch failed — return empty shell
      }

      return { id: groupId, name: '', currency: 'INR', members: [] };
    },
    enabled: Boolean(groupId),
  });
}

export function useOfflineGroupExpenses(groupId: string) {
  return useQuery<ExpenseItem[]>({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
      const expenses = await getLocalExpenses(groupId);

      if (expenses.length > 0) {
        const items: ExpenseItem[] = await Promise.all(
          expenses.map(async (e): Promise<ExpenseItem> => {
            const paidByName = await getLocalUserName(e.paid_by);
            return {
              id: e.id,
              description: e.description,
              amount: e.amount,
              currency: e.currency,
              category: e.category ?? undefined,
              created_at: e.created_at,
              paidByName,
              paidById: e.paid_by,
              splitType: e.split_type,
            };
          }),
        );
        return items;
      }

      // Fallback: fetch from server and seed local DB
      try {
        type Resp = {
          expenses: Array<{
            id: string;
            description: string;
            amount: number;
            currency: string;
            category?: string;
            created_at: string;
            paidByName?: string;
            paid_by_name?: string;
            paidById?: string;
            paid_by_id?: string;
            paid_by?: string;
            splitType?: string;
            split_type?: string;
            notes?: string;
            created_by?: string;
            updated_at?: string;
          }>;
        };
        const data = await apiClient<Resp>(
          `/api/expenses?groupId=${encodeURIComponent(groupId)}`,
        );
        const serverExpenses = data.expenses ?? [];

        if (serverExpenses.length > 0) {
          const database = getDb();
          const now = new Date().toISOString();

          await database.withTransactionAsync(async () => {
            for (const e of serverExpenses) {
              const paidBy = e.paidById ?? e.paid_by_id ?? e.paid_by ?? '';
              await database.runAsync(
                `INSERT OR REPLACE INTO local_expenses (id, group_id, description, amount, currency, paid_by, category, split_type, notes, created_by, created_at, updated_at, _sync_status, _last_synced_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
                [
                  e.id, groupId, e.description, e.amount, e.currency ?? 'INR',
                  paidBy, e.category ?? null,
                  e.splitType ?? e.split_type ?? 'equal',
                  e.notes ?? null, e.created_by ?? paidBy,
                  e.created_at ?? now, e.updated_at ?? now, now,
                ],
              );
            }
          });

          return serverExpenses.map((e): ExpenseItem => ({
            id: e.id,
            description: e.description,
            amount: e.amount,
            currency: e.currency,
            category: e.category,
            created_at: e.created_at,
            paidByName: e.paidByName ?? e.paid_by_name ?? 'Unknown',
            paidById: e.paidById ?? e.paid_by_id ?? e.paid_by,
            splitType: e.splitType ?? e.split_type,
          }));
        }
      } catch {
        // Server fetch failed — return empty
      }

      return [];
    },
    enabled: Boolean(groupId),
  });
}

export function useOfflineGroupBalances(groupId: string) {
  const session = useAuthStore((s) => s.session);

  return useQuery<Debt[]>({
    queryKey: ['balances', groupId],
    queryFn: async () => {
      const database = getDb();

      // Get all active members of this group
      const members = await database.getAllAsync<{ user_id: string }>(
        `SELECT user_id FROM local_group_members WHERE group_id = ? AND is_active = 1`,
        [groupId],
      );

      if (members.length > 0) {
        // Compute net balance per user: positive = owed money, negative = owes money
        const balances: Record<string, number> = {};
        for (const m of members) {
          balances[m.user_id] = await computeUserBalance(groupId, m.user_id);
        }

        // Simplify debts: users with negative balance owe users with positive balance
        const creditors: Array<{ userId: string; amount: number }> = [];
        const debtors: Array<{ userId: string; amount: number }> = [];

        for (const [uid, bal] of Object.entries(balances)) {
          if (bal > 0.01) {
            creditors.push({ userId: uid, amount: bal });
          } else if (bal < -0.01) {
            debtors.push({ userId: uid, amount: -bal });
          }
        }

        // Sort descending so largest debts are settled first
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        const debts: Debt[] = [];
        let ci = 0;
        let di = 0;

        while (ci < creditors.length && di < debtors.length) {
          const creditor = creditors[ci];
          const debtor = debtors[di];
          const settleAmount = Math.min(creditor.amount, debtor.amount);

          if (settleAmount > 0.01) {
            const fromName = await getLocalUserName(debtor.userId);
            const toName = await getLocalUserName(creditor.userId);

            debts.push({
              fromUserId: debtor.userId,
              fromName,
              toUserId: creditor.userId,
              toName,
              amount: Math.round(settleAmount * 100) / 100,
              currency: 'INR',
            });
          }

          creditor.amount -= settleAmount;
          debtor.amount -= settleAmount;

          if (creditor.amount < 0.01) ci++;
          if (debtor.amount < 0.01) di++;
        }

        return debts;
      }

      // Fallback: fetch from server API
      try {
        const data = await apiClient<{ debts: Debt[] }>(
          `/api/groups/${groupId}/balances`,
        );
        return data.debts ?? [];
      } catch {
        // Server fetch failed — return empty
      }

      return [];
    },
    enabled: Boolean(groupId),
  });
}

export function useOfflineGroupMembers(groupId: string) {
  const detail = useOfflineGroupDetail(groupId);
  return {
    ...detail,
    data: detail.data?.members ?? [],
  };
}

export function useOfflineActivity(groupId?: string) {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  return useQuery<ActivityItem[]>({
    queryKey: ['activity', groupId ?? 'all'],
    queryFn: async () => {
      if (!userId) return [];
      const activities = await getLocalActivity(userId);

      // Filter by groupId if provided
      const filtered = groupId
        ? activities.filter((a) => a.group_id === groupId)
        : activities;

      if (filtered.length > 0) {
        return filtered.map((a): ActivityItem => ({
          id: a.id,
          type: a.type,
          title: a.title,
          description: a.description,
          actor_id: a.actor_id,
          metadata: a.metadata ? safeJsonParse(a.metadata) : null,
          group_id: a.group_id ?? undefined,
          created_at: a.created_at,
        }));
      }

      // Fallback: fetch from server and seed local DB
      try {
        const params = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
        const data = await apiClient<{ activity: ActivityItem[] }>(
          `/api/activity${params}`,
        );
        const serverActivity = data.activity ?? [];

        if (serverActivity.length > 0) {
          const database = getDb();
          const now = new Date().toISOString();

          await database.withTransactionAsync(async () => {
            for (const a of serverActivity) {
              await database.runAsync(
                `INSERT OR IGNORE INTO local_activity_log (id, group_id, actor_id, type, title, description, metadata, created_at, _sync_status, _last_synced_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
                [
                  a.id, a.group_id ?? null, a.actor_id, a.type,
                  a.title, a.description,
                  a.metadata ? JSON.stringify(a.metadata) : null,
                  a.created_at, now,
                ],
              );
            }
          });
        }

        return serverActivity;
      } catch {
        // Server fetch failed — return empty
      }

      return [];
    },
    enabled: Boolean(userId),
  });
}

export function useOfflineUserProfile() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  return useQuery<UserProfile | null>({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!userId) return null;

      // Try local DB first
      const localUser = await getLocalUser(userId);
      if (localUser) return localUser;

      // Fallback: fetch from server and seed local DB
      try {

        const data = await apiClient<{ user: UserProfile }>('/api/users');
        const serverUser = data.user;
        if (serverUser) {
          const database = getDb();
          const now = new Date().toISOString();
          await database.runAsync(
            `INSERT OR REPLACE INTO local_users (id, name, phone, upi_id, default_currency, avatar_url, created_at, updated_at, _sync_status, _last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              userId,
              serverUser.name ?? '',
              serverUser.phone ?? null,
              serverUser.upi_id ?? null,
              serverUser.default_currency ?? 'INR',
              serverUser.avatar_url ?? null,
              now,
              now,
              now,
            ],
          );
          return serverUser;
        }
      } catch {
        // Server fetch failed — return null, will retry on next query
      }

      return null;
    },
    enabled: Boolean(userId),
  });
}

export function useOfflineUserSearch(query: string) {
  return useQuery<UserSearchResult[]>({
    queryKey: ['userSearch', query],
    queryFn: async () => {
      // User search requires network -- cannot search all users offline
      if (!isOnline()) return [];
      try {
        const data = await apiClient<{ users: UserSearchResult[] }>(
          `/api/users/search?q=${encodeURIComponent(query)}`,
        );
        return data.users ?? [];
      } catch {
        return [];
      }
    },
    enabled: query.length >= 2,
  });
}

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

export function useOfflineCreateGroup() {
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);

  return useMutation({
    mutationFn: async (body: { name: string; currency: string }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const groupId = await insertLocalGroup(
        { name: body.name, currency: body.currency },
        userId,
      );

      // Trigger sync in background (non-blocking)
      triggerSync().catch(() => {});

      return { id: groupId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create group.');
    },
  });
}

export function useOfflineCreateExpense() {
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const groupId = body.groupId as string | undefined ?? body.group_id as string;
      const splits = (body.splits as Array<{ user_id: string; amount: number; percentage?: number }>) ?? [];

      const expenseId = await insertLocalExpense(
        {
          group_id: groupId,
          description: (body.description as string) ?? '',
          amount: (body.amount as number) ?? 0,
          currency: (body.currency as string) ?? 'INR',
          paid_by: (body.paidBy as string) ?? (body.paid_by as string) ?? userId,
          category: (body.category as string | null) ?? null,
          split_type: (body.splitType as string) ?? (body.split_type as string) ?? 'equal',
          notes: (body.notes as string | null) ?? null,
        },
        splits.map((s) => ({
          user_id: s.user_id,
          amount: s.amount,
          percentage: s.percentage ?? null,
        })),
        userId,
      );

      triggerSync().catch(() => {});

      return { id: expenseId };
    },
    onSuccess: (_data, variables) => {
      const groupId = (variables.groupId as string | undefined) ?? (variables.group_id as string | undefined);
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
        queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
        queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      }
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add expense.');
    },
  });
}

export function useOfflineAddMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { groupId: string; userId: string }) => {
      const database = getDb();
      const now = new Date().toISOString();

      const Crypto = await import('expo-crypto');
      const id = Crypto.randomUUID();

      await database.withTransactionAsync(async () => {
        await database.runAsync(
          `INSERT INTO local_group_members (id, group_id, user_id, role, joined_at, is_active, _sync_status, _local_id)
           VALUES (?, ?, ?, 'member', ?, 1, 'pending', ?)`,
          [id, body.groupId, body.userId, now, id],
        );

        await database.runAsync(
          `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
           VALUES ('create', 'group_members', ?, ?, ?)`,
          [
            id,
            JSON.stringify({
              group_id: body.groupId,
              user_id: body.userId,
              role: 'member',
            }),
            now,
          ],
        );
      });

      triggerSync().catch(() => {});

      return { id };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add member.');
    },
  });
}

export function useOfflineCreateSettlement() {
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);

  return useMutation({
    mutationFn: async (body: {
      groupId?: string;
      payerId: string;
      payeeId: string;
      amount: number;
      currency: string;
      note?: string;
    }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const settlementId = await insertLocalSettlement(
        {
          group_id: body.groupId ?? '',
          payer_id: body.payerId,
          payee_id: body.payeeId,
          amount: body.amount,
          currency: body.currency,
          note: body.note ?? null,
        },
        userId,
      );

      triggerSync().catch(() => {});

      return { id: settlementId };
    },
    onSuccess: (_data, variables) => {
      if (variables.groupId) {
        queryClient.invalidateQueries({ queryKey: ['balances', variables.groupId] });
        queryClient.invalidateQueries({ queryKey: ['expenses', variables.groupId] });
      }
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record settlement.');
    },
  });
}

export function useOfflineDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { expenseId: string; groupId?: string }) => {
      const database = getDb();
      const now = new Date().toISOString();

      await database.withTransactionAsync(async () => {
        // Soft delete: set deleted_at
        await database.runAsync(
          `UPDATE local_expenses SET deleted_at = ?, updated_at = ?, _sync_status = 'pending' WHERE id = ?`,
          [now, now, params.expenseId],
        );

        // Enqueue sync
        await database.runAsync(
          `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
           VALUES ('delete', 'expenses', ?, ?, ?)`,
          [
            params.expenseId,
            JSON.stringify({ id: params.expenseId }),
            now,
          ],
        );
      });

      triggerSync().catch(() => {});

      return { id: params.expenseId };
    },
    onSuccess: (_data, variables) => {
      if (variables.groupId) {
        queryClient.invalidateQueries({ queryKey: ['expenses', variables.groupId] });
        queryClient.invalidateQueries({ queryKey: ['balances', variables.groupId] });
        queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      }
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete expense.');
    },
  });
}

export function useOfflineUpdateProfile() {
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);

  return useMutation({
    mutationFn: async (body: { name?: string; upi_id?: string; default_currency?: string }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const database = getDb();
      const now = new Date().toISOString();

      // Build SET clause dynamically for provided fields
      const setClauses: string[] = ['updated_at = ?', "_sync_status = 'pending'"];
      const values: Array<string | number | null> = [now];

      if (body.name !== undefined) {
        setClauses.push('name = ?');
        values.push(body.name);
      }
      if (body.upi_id !== undefined) {
        setClauses.push('upi_id = ?');
        values.push(body.upi_id);
      }
      if (body.default_currency !== undefined) {
        setClauses.push('default_currency = ?');
        values.push(body.default_currency);
      }

      values.push(userId);

      await database.withTransactionAsync(async () => {
        await database.runAsync(
          `UPDATE local_users SET ${setClauses.join(', ')} WHERE id = ?`,
          values,
        );

        await database.runAsync(
          `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
           VALUES ('update', 'users', ?, ?, ?)`,
          [userId, JSON.stringify(body), now],
        );
      });

      triggerSync().catch(() => {});

      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile.');
    },
  });
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function safeJsonParse(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return null;
  }
}
