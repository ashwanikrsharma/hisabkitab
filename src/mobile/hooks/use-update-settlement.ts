import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { apiClient } from '../lib/api-client';

type SettlementStatus = 'pending' | 'confirmed' | 'disputed';

type UpdateSettlementParams = {
  settlementId: string;
  status: SettlementStatus;
  groupId?: string;
};

/**
 * Mutation hook that calls PATCH /api/settlements/[id] to update settlement status.
 * On success, invalidates settlements and balances queries so the UI refreshes.
 */
export function useUpdateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ settlementId, status }: UpdateSettlementParams) => {
      return apiClient(`/api/settlements/${settlementId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (_data, variables) => {
      if (variables.groupId) {
        queryClient.invalidateQueries({ queryKey: ['settlements', variables.groupId] });
        queryClient.invalidateQueries({ queryKey: ['balances', variables.groupId] });
        queryClient.invalidateQueries({ queryKey: ['expenses', variables.groupId] });
      }
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (err) => {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update settlement status.',
      );
    },
  });
}
