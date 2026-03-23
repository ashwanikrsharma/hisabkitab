import { CURRENCY_SYMBOLS, type SupportedCurrency } from '../constants';

// ─── Currency Formatting ──────────────────────────────────────────────────────

/**
 * Formats an amount with the currency symbol for the Indian market.
 * @example formatCurrency(1234.5, 'INR') => '₹1,234.50'
 */
export function formatCurrency(amount: number, currency: SupportedCurrency = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${symbol}${formatted}`;
}

/**
 * Formats a balance with sign and color hint.
 * @returns { text: string, isPositive: boolean }
 */
export function formatBalance(
  amount: number,
  currency: SupportedCurrency = 'INR',
): { text: string; isPositive: boolean } {
  const abs = formatCurrency(Math.abs(amount), currency);
  if (amount > 0.01) return { text: `+${abs}`, isPositive: true };
  if (amount < -0.01) return { text: `-${abs}`, isPositive: false };
  return { text: 'Settled up', isPositive: true };
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a date string for display in the Indian locale.
 * @example formatDate('2024-01-15T10:30:00Z') => '15 Jan 2024'
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns a relative time string (e.g. "2 hours ago", "yesterday").
 */
export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(isoString);
}

// ─── Split Calculations ───────────────────────────────────────────────────────

/**
 * Calculates equal split amounts, distributing remainder by paise (1/100 of ₹).
 * Ensures splits sum exactly to the total amount.
 */
export function calculateEqualSplits(
  totalAmount: number,
  memberCount: number,
): number[] {
  if (memberCount <= 0) return [];
  const base = Math.floor((totalAmount * 100) / memberCount) / 100;
  const remainder = Math.round((totalAmount - base * memberCount) * 100);
  return Array.from({ length: memberCount }, (_, i) =>
    i < remainder ? base + 0.01 : base,
  );
}

/**
 * Validates that the splits sum to the total (within ₹0.01 tolerance).
 */
export function validateSplitSum(splits: number[], total: number): boolean {
  const sum = splits.reduce((a, b) => a + b, 0);
  return Math.abs(sum - total) < 0.01;
}

// ─── String Utilities ─────────────────────────────────────────────────────────

/**
 * Truncates a string and appends ellipsis if over maxLength.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Generates a display name from a list of group member names.
 * @example groupDisplayName(['Alice', 'Bob', 'Charlie']) => 'Alice, Bob & Charlie'
 */
export function groupDisplayNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(', ');
  return `${rest} & ${last}`;
}

/**
 * Returns initials from a display name (for avatars).
 * @example getInitials('Rahul Sharma') => 'RS'
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Checks if a string is a valid UPI ID.
 */
export function isValidUpiId(upiId: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upiId);
}

/**
 * Normalizes an Indian phone number to E.164 format (+91XXXXXXXXXX).
 * Returns null if the number cannot be normalized.
 */
export function normalizeIndianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('91')) {
    // 13 digits starting with 91 is invalid — Indian numbers are +91 + 10 digits = 12 digits total
    return null;
  }
  return null;
}
