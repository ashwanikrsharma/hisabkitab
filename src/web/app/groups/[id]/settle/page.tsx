'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

export default function SettlePage() {
  return (
    <Suspense>
      <SettleForm />
    </Suspense>
  );
}

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
];

function SettleForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const groupId = params.id as string;

  const payeeId = searchParams.get('payee') ?? '';
  const prefillAmount = searchParams.get('amount') ?? '';
  const payeeName = searchParams.get('name') ?? '';
  const currency = searchParams.get('currency') ?? 'INR';

  const [amount, setAmount] = useState(prefillAmount);
  const [method, setMethod] = useState('upi');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!payeeId) {
      setError('No payee specified');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          payerId: 'self',
          payeeId,
          amount: numAmount,
          currency,
          note: note.trim() || undefined,
          paymentMethod: method,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to create settlement');
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

  return (
    <div className="min-h-screen">
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-display font-bold text-white">Settle Up</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-6 opacity-0 animate-scale-in">
          {/* Payee info */}
          {payeeName && (
            <div className="mb-6 text-center">
              <p className="text-sm text-ink-secondary">Paying</p>
              <p className="text-lg font-display font-bold text-ink mt-1">{payeeName}</p>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-ink mb-1.5">
                Amount <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">({currency})</span> <span className="text-danger">*</span>
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

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Payment method</label>
              <div className="flex gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      method === m.value
                        ? 'border-accent bg-accent-light text-accent shadow-sm'
                        : 'border-gray-200 text-ink-secondary hover:bg-surface-sunken'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-ink mb-1.5">
                Note <span className="text-ink-muted text-xs">(optional)</span>
              </label>
              <input
                id="note"
                type="text"
                placeholder="e.g. Paid via Google Pay"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                disabled={loading}
                className="input-field"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Link href={`/groups/${groupId}`} className="btn-secondary flex-1 text-center">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !amount || !payeeId}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Recording...
                  </span>
                ) : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
