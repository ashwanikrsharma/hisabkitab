// ─── Client ───────────────────────────────────────────────────────────────────
export { getServerClient, getAnonClient, getAuthedClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  User,
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  Settlement,
  AdminAuditLog,
  AnalyticsDaily,
  Database,
  SplitType,
  SettlementStatus,
  AuditAction,
  Activity,
  ActivityType,
} from './types';

// ─── Queries ──────────────────────────────────────────────────────────────────
export {
  getUserGroups,
  getGroupById,
  createGroup,
  archiveGroup,
  updateGroup,
  addGroupMember,
} from './queries/groups';
export type { GroupWithMembers } from './queries/groups';

export {
  getGroupExpenses,
  createExpense,
  deleteExpense,
} from './queries/expenses';
export type { ExpenseWithSplits, CreateExpenseInput } from './queries/expenses';

export {
  getGroupSettlements,
  createSettlement,
  updateSettlementStatus,
  settleExpenseSplits,
} from './queries/settlements';
export type { CreateSettlementInput } from './queries/settlements';

export { getGroupBalances, simplifyDebts } from './queries/balances';
export type { UserBalance, BalanceSummary } from './queries/balances';

export {
  getDirectExpenses,
  getDirectSettlements,
  getDirectBalances,
  getDirectExpensesBetweenUsers,
  getDirectSettlementsBetweenUsers,
  getDirectBalanceBetweenUsers,
} from './queries/direct-expenses';
export type { DirectBalanceSummary } from './queries/direct-expenses';

export { getUserProfile, upsertUser, updateUserProfile } from './queries/users';

export {
  getGroupActivity,
  getUserActivity,
  createActivity,
} from './queries/activity';
export type { CreateActivityInput } from './queries/activity';

export { logAgentMetric } from './queries/agent-metrics';
export type { LogAgentMetricInput } from './queries/agent-metrics';
