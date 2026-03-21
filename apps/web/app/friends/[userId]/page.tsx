import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getDirectExpensesBetweenUsers,
  getDirectSettlementsBetweenUsers,
  getUserProfile,
  getDirectBalanceBetweenUsers,
} from '@hisabkitab/db';
import type { User } from '@hisabkitab/db';
import { DeleteExpenseButton } from './delete-expense-button';

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

export default async function FriendDetailPage({ params }: { params: { userId: string } }) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const friendId = params.userId;

  let friend: User | null = null;
  try {
    friend = await getUserProfile(friendId);
  } catch (err) {
    console.error('[FriendDetailPage] getUserProfile failed:', err);
  }

  if (!friend) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-secondary mb-3">User not found</p>
          <Link href="/dashboard" className="text-accent font-semibold text-sm">Go home</Link>
        </div>
      </div>
    );
  }

  const [expenses, settlements, pairwiseBalance] = await Promise.all([
    getDirectExpensesBetweenUsers(user.id, friendId).catch(() => []),
    getDirectSettlementsBetweenUsers(user.id, friendId).catch(() => []),
    getDirectBalanceBetweenUsers(user.id, friendId).catch(() => ({ netBalance: 0, currency: 'INR' })),
  ]);

  const netBalance = pairwiseBalance.netBalance;
  const currency = pairwiseBalance.currency;

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Math.abs(amount));

  return (
    <div className="min-h-screen pb-nav">
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-display font-bold text-white">{friend.name}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Friend info + balance */}
        <section className="card p-6 text-center opacity-0 animate-scale-in">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarColor(friend.name)} flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 shadow-sm`}>
            {friend.name.slice(0, 2).toUpperCase()}
          </div>
          <h2 className="text-lg font-display font-bold text-ink">{friend.name}</h2>
          {friend.phone && <p className="text-sm text-ink-muted mt-0.5">{friend.phone}</p>}

          <div className="mt-4">
            {Math.abs(netBalance) < 0.01 ? (
              <p className="text-sm text-ink-secondary font-medium">All settled up!</p>
            ) : netBalance > 0 ? (
              <div>
                <p className="text-xs text-ink-secondary">owes you</p>
                <p className="text-2xl font-display font-bold text-success text-currency">{fmt(netBalance)}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-ink-secondary">you owe</p>
                <p className="text-2xl font-display font-bold text-danger text-currency">{fmt(netBalance)}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-5 justify-center">
            <Link
              href={`/expenses/new?friend=${friendId}&name=${encodeURIComponent(friend.name)}`}
              className="btn-secondary px-5 text-sm"
            >
              Add Expense
            </Link>
            {netBalance < -0.01 && (
              <Link
                href={`/settle?payee=${friendId}&amount=${Math.abs(netBalance).toFixed(2)}&name=${encodeURIComponent(friend.name)}&currency=${currency}`}
                className="btn-primary px-5 text-sm"
              >
                Settle Up
              </Link>
            )}
          </div>
        </section>

        {/* Expense history */}
        <section className="opacity-0 animate-fade-up stagger-1">
          <h3 className="text-base font-display font-bold text-ink mb-3">Expenses</h3>

          {expenses.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <p className="text-sm text-ink-secondary">No expenses yet.</p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {expenses.map((exp) => {
                const isPayer = exp.paid_by === user.id;
                return (
                  <div key={exp.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{exp.description}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {isPayer ? 'You paid' : `${friend.name} paid`}
                        {' · '}
                        {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold text-currency ${isPayer ? 'text-success' : 'text-danger'}`}>
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: exp.currency }).format(exp.amount)}
                    </span>
                    {exp.created_by === user.id && (
                      <DeleteExpenseButton expenseId={exp.id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Settlement history */}
        <section className="opacity-0 animate-fade-up stagger-2">
          <h3 className="text-base font-display font-bold text-ink mb-3">Settlements</h3>

          {settlements.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <p className="text-sm text-ink-secondary">No settlements yet.</p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {settlements.map((s) => {
                const youPaid = s.payer_id === user.id;
                return (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {youPaid ? `You paid ${friend.name}` : `${friend.name} paid you`}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {s.status}
                        {' · '}
                        {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-currency text-success">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: s.currency }).format(s.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
