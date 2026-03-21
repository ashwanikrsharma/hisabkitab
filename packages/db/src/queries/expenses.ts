import { getServerClient } from '../client';
import type { Expense, ExpenseSplit, SplitType } from '../types';

export type ExpenseWithSplits = Expense & { splits: ExpenseSplit[] };

export type CreateExpenseInput = {
  groupId?: string;
  description: string;
  amount: number;
  currency: string;
  paidById: string;
  category?: string;
  splitType: SplitType;
  createdBy: string;
  notes?: string;
  splits?: Array<{ userId: string; amount: number; percentage?: number }>;
  /** User IDs to split among (used for auto-computing equal splits) */
  splitAmongUserIds?: string[];
};

/**
 * Returns expenses for a group, ordered by created_at desc.
 * RLS ensures the caller is a group member.
 */
export async function getGroupExpenses(
  groupId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ExpenseWithSplits[]> {
  const db = getServerClient();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await db
    .from('expenses')
    .select('*, splits:expense_splits(*)')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getGroupExpenses: ${error.message}`);

  return (data ?? []) as unknown as ExpenseWithSplits[];
}

/**
 * Creates an expense and its splits within a transaction.
 * Automatically computes equal splits if not provided.
 */
export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const db = getServerClient();

  const { data: expense, error: expenseError } = await db
    .from('expenses')
    .insert({
      group_id: input.groupId ?? null,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      paid_by: input.paidById,
      category: input.category ?? null,
      split_type: input.splitType,
      notes: input.notes ?? null,
      created_by: input.createdBy,
      deleted_at: null,
    })
    .select()
    .single();

  if (expenseError) throw new Error(`createExpense (insert): ${expenseError.message}`);
  if (!expense) throw new Error('createExpense: no data returned');

  const expenseData = expense as unknown as Expense;

  // Insert splits — auto-compute equal splits if not explicitly provided
  let splitRows: Array<{
    expense_id: string;
    user_id: string;
    amount: number;
    percentage: number | null;
    settled: boolean;
  }> = [];

  if (input.splits && input.splits.length > 0) {
    splitRows = input.splits.map((s) => ({
      expense_id: expenseData.id,
      user_id: s.userId,
      amount: s.amount,
      percentage: s.percentage ?? null,
      settled: false,
    }));
  } else if (input.splitType === 'equal' && input.splitAmongUserIds && input.splitAmongUserIds.length > 0) {
    const memberCount = input.splitAmongUserIds.length;
    const base = Math.floor((input.amount * 100) / memberCount) / 100;
    const remainder = Math.round((input.amount - base * memberCount) * 100);

    splitRows = input.splitAmongUserIds.map((userId, i) => ({
      expense_id: expenseData.id,
      user_id: userId,
      amount: i < remainder ? base + 0.01 : base,
      percentage: null,
      settled: false,
    }));
  }

  if (splitRows.length > 0) {
    const { error: splitError } = await db.from('expense_splits').insert(splitRows);
    if (splitError) throw new Error(`createExpense (splits): ${splitError.message}`);
  }

  return expense as Expense;
}

/**
 * Soft-deletes an expense by setting deleted_at.
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  const db = getServerClient();

  const { error } = await db
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', expenseId);

  if (error) throw new Error(`deleteExpense: ${error.message}`);
}
