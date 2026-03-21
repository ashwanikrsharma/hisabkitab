// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  User,
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  Settlement,
  UserBalance,
  DebtSimplification,
  ApiError,
  PaginatedResponse,
  SplitType,
  SettlementStatus,
  GroupRole,
  ExpenseCategory,
  SupportedCurrency,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────
export {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  CURRENCY_SYMBOLS,
  EXPENSE_CATEGORIES,
  CATEGORY_ICONS,
  SPLIT_TYPES,
  SETTLEMENT_STATUSES,
  GROUP_ROLES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_GROUP_MEMBERS,
  MAX_EXPENSE_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CONVERSATION_HISTORY,
  INDIAN_PHONE_REGEX,
  UPI_ID_REGEX,
} from './constants';

// ─── Utilities ────────────────────────────────────────────────────────────────
export {
  formatCurrency,
  formatBalance,
  formatDate,
  formatRelativeTime,
  calculateEqualSplits,
  validateSplitSum,
  truncate,
  groupDisplayNames,
  getInitials,
  isValidUpiId,
  normalizeIndianPhone,
} from './utils';
