// ─── App-wide constants for HisabKitab ───────────────────────────────────────

// ─── Currencies ───────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = 'INR';

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
};

// ─── Expense Categories ───────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'accommodation',
  'entertainment',
  'utilities',
  'shopping',
  'health',
  'travel',
  'groceries',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍔',
  transport: '🚕',
  accommodation: '🏠',
  entertainment: '🎬',
  utilities: '💡',
  shopping: '🛍️',
  health: '💊',
  travel: '✈️',
  groceries: '🛒',
  other: '📦',
};

// ─── Split Types ──────────────────────────────────────────────────────────────

export const SPLIT_TYPES = ['equal', 'exact', 'percentage'] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

// ─── Settlement Status ────────────────────────────────────────────────────────

export const SETTLEMENT_STATUSES = ['pending', 'confirmed', 'disputed'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

// ─── Group Roles ──────────────────────────────────────────────────────────────

export const GROUP_ROLES = ['admin', 'member'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

// ─── Pagination ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_GROUP_MEMBERS = 50;
export const MAX_EXPENSE_DESCRIPTION_LENGTH = 500;
export const MAX_GROUP_NAME_LENGTH = 100;
export const MAX_NOTE_LENGTH = 300;

// ─── AI ───────────────────────────────────────────────────────────────────────

export const MAX_CHAT_MESSAGE_LENGTH = 2000;
export const MAX_CONVERSATION_HISTORY = 20;

// ─── Regex Patterns ───────────────────────────────────────────────────────────

/** Validates Indian phone numbers in E.164 format */
export const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

/** Validates UPI IDs */
export const UPI_ID_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;
