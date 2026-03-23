import { getServerClient } from '../client';
import type { Settlement, SettlementStatus } from '../types';

export type CreateSettlementInput = {
  groupId?: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  note?: string;
  upiTransactionId?: string;
  paymentMethod?: string;
};

/**
 * Returns all settlements for a group ordered by created_at desc.
 */
export async function getGroupSettlements(groupId: string): Promise<Settlement[]> {
  const db = getServerClient();

  const { data, error } = await db
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getGroupSettlements: ${error.message}`);

  return (data ?? []) as Settlement[];
}

/**
 * Creates a new settlement record with status 'pending'.
 */
export async function createSettlement(input: CreateSettlementInput): Promise<Settlement> {
  const db = getServerClient();

  const { data, error } = await db
    .from('settlements')
    .insert({
      group_id: input.groupId ?? null,
      payer_id: input.payerId,
      payee_id: input.payeeId,
      amount: input.amount,
      currency: input.currency,
      status: 'pending' as SettlementStatus,
      note: input.note ?? null,
      upi_transaction_id: input.upiTransactionId ?? null,
      payment_method: input.paymentMethod ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createSettlement: ${error.message}`);
  if (!data) throw new Error('createSettlement: no data returned');

  // Mark relevant expense splits as settled
  await settleExpenseSplits(input.payerId, input.payeeId, input.groupId ?? null);

  return data as Settlement;
}

/**
 * Marks unsettled expense_splits as settled between two users.
 * Settles splits where the payer has outstanding splits in expenses paid by the payee.
 * Scoped to a specific group, or to direct (groupless) expenses when groupId is null.
 */
export async function settleExpenseSplits(
  payerId: string,
  payeeId: string,
  groupId: string | null,
): Promise<void> {
  const db = getServerClient();

  // Find expenses where the payee was the one who paid
  const expenseQuery = db
    .from('expenses')
    .select('id')
    .eq('paid_by', payeeId)
    .is('deleted_at', null);

  if (groupId) {
    expenseQuery.eq('group_id', groupId);
  } else {
    expenseQuery.is('group_id', null);
  }

  const { data: expenses, error: expError } = await expenseQuery;
  if (expError) throw new Error(`settleExpenseSplits (expenses): ${expError.message}`);

  const expenseIds = (expenses ?? []).map((e) => e.id);
  if (expenseIds.length === 0) return;

  // Mark the payer's unsettled splits in those expenses as settled
  const { error: updateError } = await db
    .from('expense_splits')
    .update({ settled: true })
    .eq('user_id', payerId)
    .eq('settled', false)
    .in('expense_id', expenseIds);

  if (updateError) throw new Error(`settleExpenseSplits (update): ${updateError.message}`);
}

/**
 * Updates settlement status (e.g., payer confirms, payee disputes).
 */
export async function updateSettlementStatus(
  settlementId: string,
  status: SettlementStatus,
): Promise<Settlement> {
  const db = getServerClient();

  const { data, error } = await db
    .from('settlements')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', settlementId)
    .select()
    .single();

  if (error) throw new Error(`updateSettlementStatus: ${error.message}`);
  if (!data) throw new Error('updateSettlementStatus: no data returned');

  return data as Settlement;
}
