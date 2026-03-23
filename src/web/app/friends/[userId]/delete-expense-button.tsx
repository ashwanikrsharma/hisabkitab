'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm('Delete this expense?')) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === 'string' ? data.error : 'Failed to delete');
      }
    } catch {
      setError('Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleDelete}
        disabled={deleting}
        title="Delete expense"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:text-danger hover:bg-danger-light transition-all disabled:opacity-50 active:scale-90"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      {error && (
        <div className="absolute right-0 top-full mt-1 z-10 whitespace-nowrap rounded-lg bg-danger-light border border-danger/20 px-3 py-1.5 text-xs text-danger shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}
