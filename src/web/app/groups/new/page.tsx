'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewGroupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), currency: 'INR' }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: unknown };
          const message = typeof body.error === 'string' ? body.error : 'Failed to create group.';
          console.error('Failed to create group:', message);
        }
      }).catch(() => {
        console.error('Failed to create group');
      });

      router.push('/groups');
      router.refresh();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/groups" className="text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-display font-bold text-white">New Group</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-6 opacity-0 animate-scale-in">
          {error && (
            <div className="mb-5 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="group-name" className="block text-sm font-medium text-ink mb-1.5">
                Group Name <span className="text-danger">*</span>
              </label>
              <input
                id="group-name"
                type="text"
                placeholder="e.g. Goa Trip, Flatmates, Office Lunch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                disabled={loading}
                className="input-field"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/groups" className="btn-secondary flex-1 text-center">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || name.trim().length === 0}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
