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

// ─── Query Hooks ─────────────────────────────────────────────────────────────

export function useGroups() {
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

export function useGroupDetail(groupId: string) {
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

export function useGroupExpenses(groupId: string) {
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

export function useGroupBalances(groupId: string) {
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

export function useGroupMembers(groupId: string) {
  const detail = useGroupDetail(groupId);
  return {
    ...detail,
    data: detail.data?.members ?? [],
  };
}

export function useActivity(groupId?: string) {
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

export function useUserProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const data = await apiClient<{ user: UserProfile }>('/api/users');
      return data.user;
    },
  });
}

export function useUserSearch(query: string) {
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

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

export function useCreateGroup() {
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

export function useCreateExpense() {
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

export function useCreateSettlement() {
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

export function useAddMember() {
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

export function useDeleteExpense() {
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

export function useUpdateProfile() {
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

// Re-export types for consumers
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
