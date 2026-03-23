/**
 * API hooks — offline-first by default.
 *
 * This file re-exports offline hooks under the original names so existing
 * screen imports continue to work without changes. The original online-only
 * hooks are preserved with an `Online` prefix for fallback use.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Re-export types for consumers ───────────────────────────────────────────

export type {
  GroupListItem,
  GroupDetail,
  GroupMember,
  ExpenseItem,
  Debt,
  ActivityItem,
  UserProfile,
  UserSearchResult,
};

// ─── Default exports: offline-first hooks ────────────────────────────────────

export { useOfflineGroups as useGroups } from './use-offline-api';
export { useOfflineGroupDetail as useGroupDetail } from './use-offline-api';
export { useOfflineGroupExpenses as useGroupExpenses } from './use-offline-api';
export { useOfflineGroupBalances as useGroupBalances } from './use-offline-api';
export { useOfflineGroupMembers as useGroupMembers } from './use-offline-api';
export { useOfflineActivity as useActivity } from './use-offline-api';
export { useOfflineUserProfile as useUserProfile } from './use-offline-api';
export { useOfflineCreateGroup as useCreateGroup } from './use-offline-api';
export { useOfflineCreateExpense as useCreateExpense } from './use-offline-api';
export { useOfflineAddMember as useAddMember } from './use-offline-api';
export { useOfflineCreateSettlement as useCreateSettlement } from './use-offline-api';
export { useOfflineDeleteExpense as useDeleteExpense } from './use-offline-api';
export { useOfflineUpdateProfile as useUpdateProfile } from './use-offline-api';
export { useOfflineUserSearch as useUserSearch } from './use-offline-api';

// ─── Online-only hooks (preserved with Online prefix for fallback) ───────────

export function useOnlineGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      type Resp = {
        groups: Array<{
          id: string;
          name: string;
          currency: string;
          memberCount?: number;
          member_count?: number;
          yourBalance?: number;
          your_balance?: number;
        }>;
      };
      const data = await apiClient<Resp>('/api/groups');
      return (data.groups ?? []).map((g): GroupListItem => ({
        id: g.id,
        name: g.name,
        currency: g.currency,
        memberCount: g.memberCount ?? g.member_count ?? 0,
        yourBalance: g.yourBalance ?? g.your_balance ?? 0,
      }));
    },
  });
}

export function useOnlineGroupDetail(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      type Resp = {
        group?: GroupDetail;
        id?: string;
        name?: string;
        currency?: string;
        members?: GroupMember[];
      };
      const data = await apiClient<Resp>(`/api/groups/${groupId}`);
      const g = data.group ?? (data as GroupDetail);
      return {
        id: g.id ?? groupId,
        name: g.name ?? '',
        currency: g.currency ?? 'INR',
        members: g.members ?? [],
      } as GroupDetail;
    },
    enabled: Boolean(groupId),
  });
}

export function useOnlineGroupExpenses(groupId: string) {
  return useQuery({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
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
          splitType?: string;
          split_type?: string;
        }>;
      };
      const data = await apiClient<Resp>(
        `/api/expenses?groupId=${encodeURIComponent(groupId)}`,
      );
      return (data.expenses ?? []).map((e): ExpenseItem => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        created_at: e.created_at,
        paidByName: e.paidByName ?? e.paid_by_name ?? 'Unknown',
        paidById: e.paidById ?? e.paid_by_id,
        splitType: e.splitType ?? e.split_type,
      }));
    },
    enabled: Boolean(groupId),
  });
}

export function useOnlineGroupBalances(groupId: string) {
  return useQuery({
    queryKey: ['balances', groupId],
    queryFn: async () => {
      const data = await apiClient<{ debts: Debt[] }>(
        `/api/groups/${groupId}/balances`,
      );
      return data.debts ?? [];
    },
    enabled: Boolean(groupId),
  });
}

export function useOnlineGroupMembers(groupId: string) {
  const detail = useOnlineGroupDetail(groupId);
  return {
    ...detail,
    data: detail.data?.members ?? [],
  };
}

export function useOnlineActivity(groupId?: string) {
  const params = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
  return useQuery({
    queryKey: ['activity', groupId ?? 'all'],
    queryFn: async () => {
      const data = await apiClient<{ activity: ActivityItem[] }>(
        `/api/activity${params}`,
      );
      return data.activity ?? [];
    },
  });
}

export function useOnlineUserProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const data = await apiClient<{ user: UserProfile }>('/api/users');
      return data.user;
    },
  });
}

export function useOnlineUserSearch(query: string) {
  return useQuery({
    queryKey: ['userSearch', query],
    queryFn: async () => {
      const data = await apiClient<{ users: UserSearchResult[] }>(
        `/api/users/search?q=${encodeURIComponent(query)}`,
      );
      return data.users ?? [];
    },
    enabled: query.length >= 2,
  });
}

export function useOnlineCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; currency: string }) =>
      apiClient('/api/groups', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create group.');
    },
  });
}

export function useOnlineCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      const groupId = variables.groupId as string | undefined;
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

export function useOnlineCreateSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      groupId?: string;
      payerId: string;
      payeeId: string;
      amount: number;
      currency: string;
      note?: string;
    }) =>
      apiClient('/api/settlements', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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

export function useOnlineAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { groupId: string; userId: string }) =>
      apiClient(`/api/groups/${body.groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: body.userId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add member.');
    },
  });
}

export function useOnlineDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { expenseId: string; groupId?: string }) =>
      apiClient(`/api/expenses/${params.expenseId}`, { method: 'DELETE' }),
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

export function useOnlineUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; upi_id?: string; default_currency?: string }) =>
      apiClient('/api/users', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile.');
    },
  });
}
