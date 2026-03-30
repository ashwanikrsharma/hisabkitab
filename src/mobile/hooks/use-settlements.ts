import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

type SettlementStatus = 'pending' | 'confirmed' | 'disputed';

export type SettlementItem = {
  id: string;
  group_id: string | null;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Fetches settlement history for a group from GET /api/settlements?groupId=X.
 */
export function useSettlements(groupId: string) {
  return useQuery<SettlementItem[]>({
    queryKey: ['settlements', groupId],
    queryFn: async () => {
      try {
        const data = await apiClient<{ settlements: SettlementItem[] }>(
          `/api/settlements?groupId=${encodeURIComponent(groupId)}`,
        );
        return data.settlements ?? [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(groupId),
  });
}
