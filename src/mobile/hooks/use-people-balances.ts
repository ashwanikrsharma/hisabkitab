/**
 * Composes useGroups() + useGroupBalances() to aggregate per-person net
 * balances across all groups, and group-level settlement data.
 *
 * Mirrors the web dashboard logic in src/web/app/dashboard/page.tsx.
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useGroups } from './use-api';
import type { GroupListItem, Debt } from './use-api';
import { computeGroupDebts } from './use-offline-api';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PersonBalance = {
  userId: string;
  name: string;
  youOwe: number;
  owesYou: number;
  net: number;
  currency: string;
};

export type GroupSettlement = {
  group: GroupListItem;
  debts: Debt[];
  currency: string;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fetches balance data for every group the user belongs to, then aggregates
 * into a per-person summary and per-group settlement list.
 *
 * Uses useQueries with the same queryKey as useGroupBalances so that cached
 * data from offline hooks is reused. Falls back to API fetch if no cache exists.
 */
export function usePeopleBalances() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id ?? '';

  const { data: groups, isLoading: groupsLoading, refetch: refetchGroups } = useGroups();

  const groupList = groups ?? [];

  // Parallel balance queries for all groups — uses same queryKey as
  // useGroupBalances so offline-cached data is shared automatically.
  const balanceQueries = useQueries({
    queries: groupList.map((g) => ({
      queryKey: ['balances', g.id] as const,
      queryFn: async (): Promise<Debt[]> => {
        // Try local DB first (offline-capable)
        const localDebts = await computeGroupDebts(g.id);
        if (localDebts.length > 0) return localDebts;
        // Fallback to API if local DB has no data yet
        const data = await apiClient<{ debts: Debt[] }>(
          `/api/groups/${g.id}/balances`,
        );
        return data.debts ?? [];
      },
      enabled: Boolean(userId) && groupList.length > 0,
      // Prefer cached data from offline hooks; only refetch if stale
      staleTime: 30_000,
    })),
  });

  const allBalancesSettled = !balanceQueries.some((q) => q.isLoading);
  const isLoading = groupsLoading || !allBalancesSettled;

  const { people, groupSettlements } = useMemo(() => {
    if (!userId || groupList.length === 0) {
      return { people: [] as PersonBalance[], groupSettlements: [] as GroupSettlement[] };
    }

    const personMap = new Map<string, PersonBalance>();
    const settlements: GroupSettlement[] = [];

    for (let i = 0; i < groupList.length; i++) {
      const group = groupList[i]!;
      const debts: Debt[] = balanceQueries[i]?.data ?? [];

      // Build person map (same logic as web dashboard)
      for (const debt of debts) {
        if (debt.fromUserId === userId) {
          // I owe someone
          const existing = personMap.get(debt.toUserId);
          if (existing) {
            existing.youOwe += debt.amount;
            existing.net = existing.owesYou - existing.youOwe;
          } else {
            personMap.set(debt.toUserId, {
              userId: debt.toUserId,
              name: debt.toName,
              youOwe: debt.amount,
              owesYou: 0,
              net: -debt.amount,
              currency: debt.currency || group.currency,
            });
          }
        } else if (debt.toUserId === userId) {
          // Someone owes me
          const existing = personMap.get(debt.fromUserId);
          if (existing) {
            existing.owesYou += debt.amount;
            existing.net = existing.owesYou - existing.youOwe;
          } else {
            personMap.set(debt.fromUserId, {
              userId: debt.fromUserId,
              name: debt.fromName,
              youOwe: 0,
              owesYou: debt.amount,
              net: debt.amount,
              currency: debt.currency || group.currency,
            });
          }
        }
      }

      // Build settlements: debts in this group involving the current user
      const myDebts = debts.filter(
        (d) => d.fromUserId === userId || d.toUserId === userId,
      );
      if (myDebts.length > 0) {
        settlements.push({
          group,
          debts: myDebts,
          currency: group.currency,
        });
      }
    }

    // Sort people by total involvement (descending)
    const peopleList = Array.from(personMap.values()).sort(
      (a, b) => (b.youOwe + b.owesYou) - (a.youOwe + a.owesYou),
    );

    return { people: peopleList, groupSettlements: settlements };
  }, [userId, groupList, balanceQueries]);

  const refetch = () => {
    refetchGroups();
    for (const q of balanceQueries) {
      q.refetch();
    }
  };

  return {
    people,
    groupSettlements,
    isLoading,
    refetch,
  };
}
