'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

export default function NewDirectExpensePage() {
  return (
    <Suspense>
      <NewDirectExpenseForm />
    </Suspense>
  );
}

const CATEGORIES = [
  { value: '', label: 'Select category', icon: '' },
  { value: 'food', label: 'Food', icon: '🍔' },
  { value: 'transport', label: 'Transport', icon: '🚕' },
  { value: 'accommodation', label: 'Accommodation', icon: '🏠' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'utilities', label: 'Utilities', icon: '💡' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'health', label: 'Health', icon: '💊' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'groceries', label: 'Groceries', icon: '🛒' },
  { value: 'other', label: 'Other', icon: '📦' },
];

type SearchResult = {
  id: string;
  name: string;
  phone: string;
};

type SelectedFriend = {
  id: string;
  name: string;
};

const AVATAR_COLORS = [
  'from-orange-500 to-amber-600',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function NewDirectExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillFriendId = searchParams.get('friend') ?? '';
  const prefillFriendName = searchParams.get('name') ?? '';

  const [friends, setFriends] = useState<SelectedFriend[]>(
    prefillFriendId && prefillFriendName
      ? [{ id: prefillFriendId, name: prefillFriendName }]
      : [],
  );
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidByMe, setPaidByMe] = useState(true);
  const [paidByFriendId, setPaidByFriendId] = useState('');
  const [category, setCategory] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [includeSelf, setIncludeSelf] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (search.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = (await res.json()) as { users: SearchResult[] };
        setSearchResults(data.users);
        if (data.users.length === 0) {
          setError('No users found. They need to sign up first.');
        }
      } else {
        setError('Search failed');
      }
    } catch {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  }

  function addFriend(user: SearchResult) {
    if (friends.some((f) => f.id === user.id)) return;
    setFriends((prev) => [...prev, { id: user.id, name: user.name }]);
    setSearchResults([]);
    setSearch('');
  }

  function removeFriend(userId: string) {
    setFriends((prev) => prev.filter((f) => f.id !== userId));
    if (paidByFriendId === userId) {
      setPaidByFriendId('');
      setPaidByMe(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (friends.length === 0) {
      setError('Add at least one friend to split with');
      return;
    }

    // Build split user IDs (friends + optionally self)
    const splitUserIds: string[] = friends.map((f) => f.id);
    // We need the current user ID — we'll pass "self" and the API uses auth user
    if (includeSelf) {
      splitUserIds.push('self'); // placeholder, will be resolved
    }

    // Validate user is part of the expense
    const paidById = paidByMe ? 'self' : paidByFriendId;
    if (!paidById) {
      setError('Select who paid');
      return;
    }

    if (!includeSelf && !paidByMe) {
      setError('You must either pay for the expense or be included in the split');
      return;
    }

    setLoading(true);

    try {
      let splits: Array<{ userId: string; amount: number; percentage?: number }> | undefined;

      if (splitType === 'exact') {
        splits = splitUserIds.map((userId) => ({
          userId,
          amount: parseFloat(customSplits[userId] ?? '0'),
        }));
        const sum = splits.reduce((a, b) => a + b.amount, 0);
        if (Math.abs(sum - numAmount) > 0.01) {
          setError(`Custom amounts must sum to ${numAmount.toFixed(2)} (currently ${sum.toFixed(2)})`);
          setLoading(false);
          return;
        }
      } else if (splitType === 'percentage') {
        splits = splitUserIds.map((userId) => {
          const pct = parseFloat(customSplits[userId] ?? '0');
          return { userId, amount: Math.round(numAmount * pct / 100 * 100) / 100, percentage: pct };
        });
        const totalPct = splits.reduce((a, b) => a + (b.percentage ?? 0), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          setError(`Percentages must sum to 100% (currently ${totalPct.toFixed(1)}%)`);
          setLoading(false);
          return;
        }
      }

      const body: Record<string, unknown> = {
        // No groupId — this is a direct expense
        description: description.trim(),
        amount: numAmount,
        currency: 'INR',
        paidById,
        splitType,
        category: category || undefined,
        splits,
        splitAmongUserIds: splitType === 'equal' ? splitUserIds : undefined,
      };

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === 'string' ? data.error : 'Failed to create expense');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  const allSplitParticipants = [
    ...(includeSelf ? [{ id: 'self', name: 'You' }] : []),
    ...friends,
  ];

  return (
    <div className="min-h-screen pb-nav">
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-display font-bold text-white">Add Expense</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-6 opacity-0 animate-scale-in">
          {error && (
            <div className="mb-5 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-up" data-testid="error-message">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="direct-expense-form">
            {/* Friend picker */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Split with <span className="text-danger">*</span>
              </label>

              {/* Selected friends */}
              {friends.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3" data-testid="selected-friends">
                  {friends.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent-light text-accent text-sm font-medium px-3 py-1.5"
                    >
                      {f.name}
                      <button
                        type="button"
                        onClick={() => removeFriend(f.id)}
                        className="hover:text-danger transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                  className="input-field flex-1"
                  data-testid="friend-search-input"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || search.trim().length < 2}
                  className="btn-primary px-5"
                  data-testid="friend-search-button"
                >
                  {searching ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : 'Search'}
                </button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1" data-testid="search-results">
                  {searchResults.map((u) => {
                    const alreadyAdded = friends.some((f) => f.id === u.id);
                    return (
                      <div key={u.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-surface-sunken transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(u.name)} flex items-center justify-center text-white text-xs font-bold`}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-ink">{u.name}</p>
                            {u.phone && <p className="text-xs text-ink-muted">{u.phone}</p>}
                          </div>
                        </div>
                        {alreadyAdded ? (
                          <span className="text-xs text-ink-muted font-medium bg-surface-sunken px-2.5 py-1 rounded-full">Added</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addFriend(u)}
                            className="btn-primary-sm px-4 py-1.5"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-ink mb-1.5">
                Description <span className="text-danger">*</span>
              </label>
              <input
                id="description"
                type="text"
                placeholder="e.g. Coffee, Lunch, Cab ride"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={500}
                disabled={loading}
                className="input-field"
                data-testid="description-input"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-ink mb-1.5">
                Amount <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">(INR)</span> <span className="text-danger">*</span>
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={loading}
                className="input-field text-currency text-lg"
                data-testid="amount-input"
              />
            </div>

            {/* Paid by */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Paid by <span className="text-danger">*</span>
              </label>
              <div className="flex flex-wrap gap-2" data-testid="paid-by-selector">
                <button
                  type="button"
                  onClick={() => { setPaidByMe(true); setPaidByFriendId(''); }}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    paidByMe
                      ? 'border-accent bg-accent-light text-accent shadow-sm'
                      : 'border-gray-200 text-ink-secondary hover:bg-surface-sunken'
                  }`}
                >
                  You
                </button>
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setPaidByMe(false); setPaidByFriendId(f.id); }}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                      !paidByMe && paidByFriendId === f.id
                        ? 'border-accent bg-accent-light text-accent shadow-sm'
                        : 'border-gray-200 text-ink-secondary hover:bg-surface-sunken'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-ink mb-1.5">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} className="input-field">
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon ? `${c.icon} ` : ''}{c.label}</option>
                ))}
              </select>
            </div>

            {/* Split type */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Split type</label>
              <div className="flex gap-2">
                {(['equal', 'exact', 'percentage'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      splitType === type
                        ? 'border-accent bg-accent-light text-accent shadow-sm'
                        : 'border-gray-200 text-ink-secondary hover:bg-surface-sunken'
                    }`}
                  >
                    {type === 'equal' ? 'Equal' : type === 'exact' ? 'Custom' : 'Percentage'}
                  </button>
                ))}
              </div>
            </div>

            {/* Split among */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Split among <span className="text-danger">*</span>
              </label>
              <div className="space-y-1.5" data-testid="split-among">
                {/* Self */}
                <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${includeSelf ? 'bg-accent-light/50' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setIncludeSelf(!includeSelf)}
                    className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                      includeSelf
                        ? 'bg-accent border-accent text-white'
                        : 'border-gray-300 bg-surface-raised'
                    }`}
                  >
                    {includeSelf && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm text-ink flex-1 font-medium">You</span>
                  {includeSelf && splitType === 'equal' && amount && allSplitParticipants.length > 0 && (
                    <span className="text-xs text-ink-muted w-24 text-right text-currency">
                      {(parseFloat(amount) / allSplitParticipants.length).toFixed(2)}
                    </span>
                  )}
                  {includeSelf && splitType !== 'equal' && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={splitType === 'percentage' ? '%' : '0.00'}
                      value={customSplits['self'] ?? ''}
                      onChange={(e) => setCustomSplits((prev) => ({ ...prev, self: e.target.value }))}
                      className="w-24 input-field !py-1.5 text-right text-currency text-sm"
                    />
                  )}
                </div>

                {/* Friends */}
                {friends.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-accent-light/50">
                    <div className="flex-shrink-0 w-5 h-5 rounded-md border-2 bg-accent border-accent text-white flex items-center justify-center">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-ink flex-1 font-medium">{f.name}</span>
                    {splitType === 'equal' && amount && allSplitParticipants.length > 0 && (
                      <span className="text-xs text-ink-muted w-24 text-right text-currency">
                        {(parseFloat(amount) / allSplitParticipants.length).toFixed(2)}
                      </span>
                    )}
                    {splitType !== 'equal' && (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={splitType === 'percentage' ? '%' : '0.00'}
                        value={customSplits[f.id] ?? ''}
                        onChange={(e) => setCustomSplits((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-24 input-field !py-1.5 text-right text-currency text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Link href="/dashboard" className="btn-secondary flex-1 text-center">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !description.trim() || !amount || friends.length === 0}
                className="btn-primary flex-1"
                data-testid="submit-expense"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Adding...
                  </span>
                ) : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
