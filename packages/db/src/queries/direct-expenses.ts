import { getServerClient } from '../client';
import type { Settlement } from '../types';
import type { ExpenseWithSplits } from './expenses';
import type { UserBalance } from './balances';
import { simplifyDebts } from './balances';

export type DirectBalanceSummary = {
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
 * Returns direct (groupless) expenses where the user is payer, creator, or split participant.
 */
export async function getDirectExpenses(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ExpenseWithSplits[]> {
  const db = getServerClient();
  const { limit = 50, offset = 0 } = opts;

  // Fetch expenses where user is payer or creator
  const { data: paidOrCreated, error: err1 } = await db
    .from('expenses')
    .select('*, splits:expense_splits(*)')
    .is('group_id', null)
    .is('deleted_at', null)
    .or(`paid_by.eq.${userId},created_by.eq.${userId}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (err1) throw new Error(`getDirectExpenses (paid/created): ${err1.message}`);

  // Fetch expense IDs where user has a split but is NOT payer/creator
  const { data: splitExpenses, error: err2 } = await db
    .from('expense_splits')
    .select('expense_id, expenses!inner(group_id, deleted_at, paid_by, created_by)')
    .eq('user_id', userId)
    .is('expenses.group_id', null)
    .is('expenses.deleted_at', null)
    .neq('expenses.paid_by', userId)
    .neq('expenses.created_by', userId);

  if (err2) throw new Error(`getDirectExpenses (splits): ${err2.message}`);

  // Cast: Supabase can't infer join types at compile time
  const typedSplitExpenses = (splitExpenses ?? []) as unknown as Array<{ expense_id: string }>;
  const additionalIds = typedSplitExpenses.map((s) => s.expense_id);

  let additionalExpenses: unknown[] = [];
  if (additionalIds.length > 0) {
    const { data, error } = await db
      .from('expenses')
      .select('*, splits:expense_splits(*)')
      .in('id', additionalIds)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`getDirectExpenses (additional): ${error.message}`);
    additionalExpenses = data ?? [];
  }

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: ExpenseWithSplits[] = [];
  for (const exp of [...(paidOrCreated ?? []), ...additionalExpenses] as ExpenseWithSplits[]) {
    if (!seen.has(exp.id)) {
      seen.add(exp.id);
      merged.push(exp);
    }
  }

  // Sort by created_at desc
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return merged;
}

/**
 * Returns direct (groupless) settlements involving the user.
 */
export async function getDirectSettlements(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Settlement[]> {
  const db = getServerClient();
  const { limit = 50, offset = 0 } = opts;

  const { data, error } = await db
    .from('settlements')
    .select('*')
    .is('group_id', null)
    .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getDirectSettlements: ${error.message}`);
  return (data ?? []) as Settlement[];
}

/**
 * Computes balances for all direct (groupless) expenses involving the user.
 */
export async function getDirectBalances(userId: string): Promise<DirectBalanceSummary> {
  const db = getServerClient();

  // Get all unsettled direct expense splits where user is involved
  // First get expenses the user is part of
  const expenses = await getDirectExpenses(userId, { limit: 1000 });
  const expenseIds = expenses.map((e) => e.id);

  if (expenseIds.length === 0) {
    return { currency: 'INR', balances: [], simplifiedDebts: [] };
  }

  // Get all splits for those expenses
  const { data: splits, error: splitsError } = await db
    .from('expense_splits')
    .select('user_id, amount, expense_id')
    .in('expense_id', expenseIds)
    .eq('settled', false);

  if (splitsError) throw new Error(`getDirectBalances (splits): ${splitsError.message}`);

  // Build a map of expense_id -> expense for quick lookup
  const expenseMap = new Map(expenses.map((e) => [e.id, e]));

  // Collect all involved user IDs
  const userIds = new Set<string>();
  for (const exp of expenses) {
    userIds.add(exp.paid_by);
  }
  for (const split of splits ?? []) {
    userIds.add(split.user_id);
  }

  // Fetch user names
  const { data: users, error: usersError } = await db
    .from('users')
    .select('id, name')
    .in('id', Array.from(userIds));

  if (usersError) throw new Error(`getDirectBalances (users): ${usersError.message}`);

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.name);
  }

  // Build balance map
  const balanceMap = new Map<string, number>();
  for (const uid of userIds) {
    balanceMap.set(uid, 0);
  }

  for (const split of splits ?? []) {
    const expense = expenseMap.get(split.expense_id);
    if (!expense) continue;

    // User owes their share
    const current = balanceMap.get(split.user_id) ?? 0;
    balanceMap.set(split.user_id, current - split.amount);

    // Payer is owed the amount
    const payerCurrent = balanceMap.get(expense.paid_by) ?? 0;
    balanceMap.set(expense.paid_by, payerCurrent + split.amount);
  }

  const currency = expenses[0]?.currency ?? 'INR';

  const balances: UserBalance[] = Array.from(balanceMap.entries()).map(([uid, balance]) => ({
    userId: uid,
    name: nameMap.get(uid) ?? uid,
    balance,
    currency,
  }));

  const simplifiedDebtsResult = simplifyDebts(balances);

  return { currency, balances, simplifiedDebts: simplifiedDebtsResult };
}

/**
 * Returns direct expenses between two specific users.
 */
export async function getDirectExpensesBetweenUsers(
  userId: string,
  friendId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ExpenseWithSplits[]> {
  const allExpenses = await getDirectExpenses(userId, { limit: 1000 });

  // Filter to only expenses involving the friend
  const filtered = allExpenses.filter((exp) => {
    if (exp.paid_by === friendId || exp.created_by === friendId) return true;
    return exp.splits.some((s) => s.user_id === friendId);
  });

  const { limit = 50, offset = 0 } = opts;
  return filtered.slice(offset, offset + limit);
}

/**
 * Computes the pairwise net balance between two specific users from direct expenses.
 * Positive = friendId owes userId. Negative = userId owes friendId.
 * Does NOT use debt simplification — returns the true pairwise balance.
 */
export async function getDirectBalanceBetweenUsers(
  userId: string,
  friendId: string,
): Promise<{ netBalance: number; currency: string }> {
  const db = getServerClient();
  const expenses = await getDirectExpensesBetweenUsers(userId, friendId, { limit: 1000 });

  if (expenses.length === 0) {
    return { netBalance: 0, currency: 'INR' };
  }

  const expenseIds = expenses.map((e) => e.id);

  // Get unsettled splits for these expenses
  const { data: splits, error } = await db
    .from('expense_splits')
    .select('user_id, amount, expense_id')
    .in('expense_id', expenseIds)
    .eq('settled', false);

  if (error) throw new Error(`getDirectBalanceBetweenUsers (splits): ${error.message}`);

  const expenseMap = new Map(expenses.map((e) => [e.id, e]));

  // Compute net: positive means friend owes user
  let net = 0;
  for (const split of splits ?? []) {
    const expense = expenseMap.get(split.expense_id);
    if (!expense) continue;

    // If userId paid and friendId has a split → friend owes user
    if (expense.paid_by === userId && split.user_id === friendId) {
      net += split.amount;
    }
    // If friendId paid and userId has a split → user owes friend
    if (expense.paid_by === friendId && split.user_id === userId) {
      net -= split.amount;
    }
  }

  return { netBalance: net, currency: expenses[0]?.currency ?? 'INR' };
}

/**
 * Returns direct settlements between two specific users.
 */
export async function getDirectSettlementsBetweenUsers(
  userId: string,
  friendId: string,
): Promise<Settlement[]> {
  const db = getServerClient();

  const { data, error } = await db
    .from('settlements')
    .select('*')
    .is('group_id', null)
    .or(
      `and(payer_id.eq.${userId},payee_id.eq.${friendId}),and(payer_id.eq.${friendId},payee_id.eq.${userId})`,
    )
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getDirectSettlementsBetweenUsers: ${error.message}`);
  return (data ?? []) as Settlement[];
}
