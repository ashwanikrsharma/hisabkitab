'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

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

type Member = {
  id: string;
  user_id: string;
  role: string;
  users: { id: string; name: string } | null;
};

export default function NewExpensePage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [groupCurrency, setGroupCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingMembers, setFetchingMembers] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState('');
  const [category, setCategory] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, groupRes] = await Promise.all([
          fetch(`/api/groups/${groupId}/members`),
          fetch(`/api/groups/${groupId}`),
        ]);

        if (membersRes.ok) {
          const data = (await membersRes.json()) as { members: Member[] };
          setMembers(data.members);
          const allIds = new Set(data.members.map((m) => m.user_id));
          setSelectedMembers(allIds);
          if (data.members.length > 0 && !paidById) {
            setPaidById(data.members[0]?.user_id ?? '');
          }
        }

        if (groupRes.ok) {
          const data = (await groupRes.json()) as { group: { currency: string } };
          setGroupCurrency(data.group.currency);
        }
      } catch {
        setError('Failed to load group data');
      } finally {
        setFetchingMembers(false);
      }
    }
    fetchData();
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectAllMembers() {
    setSelectedMembers(new Set(members.map((m) => m.user_id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (selectedMembers.size === 0) {
      setError('Select at least one member to split with');
      return;
    }

    setLoading(true);

    try {
      let splits: Array<{ userId: string; amount: number; percentage?: number }> | undefined;

      if (splitType === 'exact') {
        splits = Array.from(selectedMembers).map((userId) => ({
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
        splits = Array.from(selectedMembers).map((userId) => {
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
        groupId,
        description: description.trim(),
        amount: numAmount,
        currency: groupCurrency,
        paidById,
        splitType,
        category: category || undefined,
        splits,
        splitAmongUserIds: splitType === 'equal' ? Array.from(selectedMembers) : undefined,
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

      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (fetchingMembers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-ink-secondary text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="text-white/80 hover:text-white transition-colors">
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
            <div className="mb-5 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-ink mb-1.5">
                Description <span className="text-danger">*</span>
              </label>
              <input
                id="description"
                type="text"
                placeholder="e.g. Dinner at restaurant"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={500}
                disabled={loading}
                className="input-field"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-ink mb-1.5">
                Amount <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">({groupCurrency})</span> <span className="text-danger">*</span>
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
              />
            </div>

            {/* Paid by */}
            <div>
              <label htmlFor="paid-by" className="block text-sm font-medium text-ink mb-1.5">
                Paid by <span className="text-danger">*</span>
              </label>
              <select id="paid-by" value={paidById} onChange={(e) => setPaidById(e.target.value)} disabled={loading} className="input-field">
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.users?.name || 'Unknown'}</option>
                ))}
              </select>
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ink">
                  Split among <span className="text-danger">*</span>
                </label>
                <button type="button" onClick={selectAllMembers} className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors">
                  Select all
                </button>
              </div>

              <div className="space-y-1.5">
                {members.map((m) => {
                  const isSelected = selectedMembers.has(m.user_id);
                  const memberName = m.users?.name || 'Unknown';
                  return (
                    <div key={m.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${isSelected ? 'bg-accent-light/50' : ''}`}>
                      <button
                        type="button"
                        onClick={() => toggleMember(m.user_id)}
                        className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-accent border-accent text-white'
                            : 'border-gray-300 bg-surface-raised'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-ink flex-1 font-medium">{memberName}</span>

                      {isSelected && splitType !== 'equal' && (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={splitType === 'percentage' ? '%' : '0.00'}
                          value={customSplits[m.user_id] ?? ''}
                          onChange={(e) => setCustomSplits((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                          className="w-24 input-field !py-1.5 text-right text-currency text-sm"
                        />
                      )}

                      {isSelected && splitType === 'equal' && amount && (
                        <span className="text-xs text-ink-muted w-24 text-right text-currency">
                          {(parseFloat(amount) / selectedMembers.size).toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Link href={`/groups/${groupId}`} className="btn-secondary flex-1 text-center">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !description.trim() || !amount || selectedMembers.size === 0}
                className="btn-primary flex-1"
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
