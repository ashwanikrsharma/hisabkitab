import type { SplitType, SettlementStatus, GroupRole, ExpenseCategory, SupportedCurrency } from '../constants';

// ─── Re-export constants types for convenience ────────────────────────────────
export type { SplitType, SettlementStatus, GroupRole, ExpenseCategory, SupportedCurrency };

// ─── Shared Domain Types ──────────────────────────────────────────────────────
// These mirror the DB types but are safe to use on the client side.
// DB-specific types (with nullable fields etc.) live in @hisabkitab/db.

export type User = {
  id: string;
  phone: string;
  name: string;
  avatarUrl: string | null;
  upiId: string | null;
  defaultCurrency: SupportedCurrency;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  currency: SupportedCurrency;
  createdBy: string;
  avatarUrl: string | null;
  isArchived: boolean;
  createdAt: string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  isActive: boolean;
};

export type Expense = {
  id: string;
  groupId: string | null;
  description: string;
  amount: number;
  currency: SupportedCurrency;
  paidBy: string;
  category: ExpenseCategory | null;
  splitType: SplitType;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseSplit = {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
  percentage: number | null;
  settled: boolean;
};

export type Settlement = {
  id: string;
  groupId: string | null;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: SupportedCurrency;
  status: SettlementStatus;
  note: string | null;
  upiTransactionId: string | null;
  createdAt: string;
};

// ─── API Response Shapes ──────────────────────────────────────────────────────

export type ApiError = {
  error: string | Record<string, string[]>; // string for simple, flatten() output for Zod
  code?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

// ─── Balance Types ────────────────────────────────────────────────────────────

export type UserBalance = {
  userId: string;
  name: string;
  balance: number; // positive = owed, negative = owes
  currency: SupportedCurrency;
};

export type DebtSimplification = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  currency: SupportedCurrency;
};
