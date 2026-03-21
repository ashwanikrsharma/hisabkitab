'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

type SearchResult = {
  id: string;
  name: string;
  phone: string;
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

export default function AddMemberPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch(`/api/groups/${groupId}/members`);
        if (res.ok) {
          const data = (await res.json()) as { members: Array<{ user_id: string }> };
          setExistingMemberIds(new Set(data.members.map((m) => m.user_id)));
        }
      } catch {}
    }
    fetchMembers();
  }, [groupId]);

  async function handleSearch() {
    if (search.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = (await res.json()) as { users: SearchResult[] };
        setResults(data.users);
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

  async function addMember(userId: string, userName: string) {
    setAdding(userId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === 'string' ? data.error : 'Failed to add member');
        return;
      }

      setSuccess(`${userName} added to the group!`);
      setExistingMemberIds((prev) => new Set([...prev, userId]));
      // Invalidate the RSC cache so the group detail page shows the new member
      router.refresh();
    } catch {
      setError('Failed to add member');
    } finally {
      setAdding(null);
    }
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
          <h1 className="text-lg font-display font-bold text-white">Add Member</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-6 opacity-0 animate-scale-in">
          {error && (
            <div className="mb-4 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-up">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl bg-success-light border border-success/20 px-4 py-3 text-sm text-success animate-fade-up">
              {success}
            </div>
          )}

          {/* Search */}
          <div className="space-y-3">
            <label htmlFor="search" className="block text-sm font-medium text-ink">
              Search by name or phone
            </label>
            <div className="flex gap-2">
              <input
                id="search"
                type="text"
                placeholder="e.g. Rahul or 98765..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || search.trim().length < 2}
                className="btn-primary !px-5"
              >
                {searching ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Search'}
              </button>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-5 space-y-1.5">
              {results.map((u) => {
                const alreadyMember = existingMemberIds.has(u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-surface-sunken transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(u.name)} flex items-center justify-center text-white text-xs font-bold`}>
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{u.name}</p>
                        {u.phone && <p className="text-xs text-ink-muted">{u.phone}</p>}
                      </div>
                    </div>
                    {alreadyMember ? (
                      <span className="text-xs text-ink-muted font-medium bg-surface-sunken px-2.5 py-1 rounded-full">Member</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addMember(u.id, u.name)}
                        disabled={adding === u.id}
                        className="btn-primary !px-4 !py-1.5 text-xs"
                      >
                        {adding === u.id ? 'Adding...' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100">
            <Link
              href={`/groups/${groupId}`}
              className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              Done adding members
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
