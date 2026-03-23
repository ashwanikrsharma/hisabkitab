import { getServerClient } from '../client';

export type UserBalance = {
  userId: string;
  name: string;
  balance: number; // positive = owed money, negative = owes money
  currency: string;
};

export type BalanceSummary = {
  groupId: string;
  currency: string;
  balances: UserBalance[];
  simplifiedDebts: Array<{
    fromUserId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    amount: number;
  }>;
};

/**
 * Computes the balance for each member in a group.
 * Balance = (amount paid by user) - (user's share of expenses)
 * Positive balance = others owe this user.
 * Negative balance = this user owes others.
 */
export async function getGroupBalances(groupId: string): Promise<BalanceSummary> {
  const db = getServerClient();

  // Get all unsettled expense splits for the group
  const { data: splits, error: splitsError } = await db
    .from('expense_splits')
    .select('user_id, amount, expenses!inner(group_id, paid_by, currency, amount)')
    .eq('expenses.group_id', groupId)
    .is('expenses.deleted_at', null)
    .eq('settled', false);

  if (splitsError) throw new Error(`getGroupBalances (splits): ${splitsError.message}`);

  // Cast: Supabase can't infer join types at compile time
  const typedSplits = (splits ?? []) as unknown as Array<{
    user_id: string;
    amount: number;
    expenses: { paid_by: string; currency: string; amount: number };
  }>;

  // Get group members with user info
  const { data: members, error: membersError } = await db
    .from('group_members')
    .select('user_id, users(name)')
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (membersError) throw new Error(`getGroupBalances (members): ${membersError.message}`);

  // Cast: same join type inference limitation
  const typedMembers = (members ?? []) as unknown as Array<{
    user_id: string;
    users: { name: string } | null;
  }>;

  // Get group currency
  const { data: group, error: groupError } = await db
    .from('groups')
    .select('currency')
    .eq('id', groupId)
    .single();

  if (groupError) throw new Error(`getGroupBalances (group): ${groupError.message}`);

  const groupData = group as unknown as { currency: string } | null;

  // Build balance map: userId -> net balance
  const balanceMap = new Map<string, number>();
  const nameMap = new Map<string, string>();

  for (const member of typedMembers) {
    balanceMap.set(member.user_id, 0);
    nameMap.set(member.user_id, member.users?.name ?? member.user_id);
  }

  for (const split of typedSplits) {
    const expense = split.expenses;

    // User owes their share
    const current = balanceMap.get(split.user_id) ?? 0;
    balanceMap.set(split.user_id, current - split.amount);

    // Payer is owed the amount
    const payerCurrent = balanceMap.get(expense.paid_by) ?? 0;
    balanceMap.set(expense.paid_by, payerCurrent + split.amount);
  }

  const balances: UserBalance[] = Array.from(balanceMap.entries()).map(([userId, balance]) => ({
    userId,
    name: nameMap.get(userId) ?? userId,
    balance,
    currency: groupData?.currency ?? 'INR',
  }));

  // Simplify debts using greedy algorithm
  const simplifiedDebts = simplifyDebts(balances);

  return {
    groupId,
    currency: groupData?.currency ?? 'INR',
    balances,
    simplifiedDebts,
  };
}

/**
 * Greedy debt simplification algorithm.
 * Reduces the number of transactions needed to settle all debts.
 */
export function simplifyDebts(
  balances: UserBalance[],
): BalanceSummary['simplifiedDebts'] {
  const result: BalanceSummary['simplifiedDebts'] = [];

  // Separate into creditors (positive balance) and debtors (negative)
  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.balance - b.balance);

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    if (!creditor || !debtor) break;

    const settleAmount = Math.min(creditor.balance, -debtor.balance);
    if (settleAmount > 0.01) {
      result.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }

    creditor.balance -= settleAmount;
    debtor.balance += settleAmount;

    if (Math.abs(creditor.balance) < 0.01) ci++;
    if (Math.abs(debtor.balance) < 0.01) di++;
  }

  return result;
}
