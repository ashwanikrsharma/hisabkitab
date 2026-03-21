import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getGroupById, getGroupExpenses, getGroupBalances, getGroupSettlements, getUserProfile } from '@hisabkitab/db';
import type { GroupWithMembers, ExpenseWithSplits, BalanceSummary, Settlement } from '@hisabkitab/db';
import { DeleteExpenseButton } from './delete-expense-button';

export const revalidate = 30;

type Props = {
  params: { id: string };
};

const CATEGORY_ICONS: Record<string, string> = {
  food: '🍔', transport: '🚕', accommodation: '🏠', entertainment: '🎬',
  utilities: '💡', shopping: '🛍️', health: '💊', travel: '✈️',
  groceries: '🛒', other: '📦',
};

const AVATAR_COLORS = [
  'from-orange-500 to-amber-600',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-fuchsia-500 to-purple-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default async function GroupDetailPage({ params }: Props) {
  const { id } = params;

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

  let group: GroupWithMembers | undefined;
  try { group = await getGroupById(id); } catch { notFound(); }
  if (!group) notFound();

  let expenses: ExpenseWithSplits[] = [];
  let balanceSummary: BalanceSummary | null = null;
  let settlements: Settlement[] = [];
  try {
    [expenses, balanceSummary, settlements] = await Promise.all([
      getGroupExpenses(id),
      getGroupBalances(id),
      getGroupSettlements(id),
    ]);
  } catch (err) {
    console.error('[GroupDetailPage] data fetch failed:', err);
  }

  // Build a name map for settlement display
  const nameCache = new Map<string, string>();
  if (balanceSummary) {
    for (const b of balanceSummary.balances) {
      nameCache.set(b.userId, b.name);
    }
  }

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);

  return (
    <div className="min-h-screen pb-nav">
      {/* Header */}
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-display font-bold text-white truncate">{group.name}</h1>
          </div>
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex-shrink-0">
            {group.currency}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Members */}
        <section className="opacity-0 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-display font-bold text-ink">
              Members <span className="text-ink-muted font-normal text-sm">({group.members.length})</span>
            </h2>
            <Link href={`/groups/${id}/members/new`} className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors">
              + Add
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.members.map((member) => {
              const label = nameCache.get(member.user_id) || member.user_id.slice(0, 8);
              return (
                <div
                  key={member.id}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-raised border border-gray-200/60 px-3 py-1.5 shadow-sm"
                >
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(label)} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {label.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-ink">{label}</span>
                  {member.role === 'admin' && (
                    <span className="text-[10px] font-bold text-gold uppercase">Admin</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Balances */}
        <section className="opacity-0 animate-fade-up stagger-1">
          <h2 className="text-base font-display font-bold text-ink mb-3">Balances</h2>

          {!balanceSummary || balanceSummary.simplifiedDebts.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-success-light text-success mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-ink-secondary font-medium">All settled up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {balanceSummary.simplifiedDebts.map((debt, idx) => {
                const iOwe = debt.fromUserId === user.id;
                return (
                  <div key={idx} className="card flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-ink-secondary">
                      {iOwe ? (
                        <>You owe <span className="font-medium text-success">{debt.toName}</span></>
                      ) : debt.toUserId === user.id ? (
                        <><span className="font-medium text-danger">{debt.fromName}</span> owes you</>
                      ) : (
                        <><span className="font-medium text-danger">{debt.fromName}</span>{' owes '}<span className="font-medium text-success">{debt.toName}</span></>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold text-currency ${iOwe ? 'text-danger' : debt.toUserId === user.id ? 'text-success' : 'text-ink'}`}>
                        {fmt(debt.amount, balanceSummary!.currency)}
                      </span>
                      {iOwe && (
                        <Link
                          href={`/groups/${id}/settle?payee=${debt.toUserId}&amount=${debt.amount}&name=${encodeURIComponent(debt.toName)}&currency=${balanceSummary!.currency}`}
                          className="btn-primary-sm"
                        >
                          Settle
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Expenses */}
        <section className="opacity-0 animate-fade-up stagger-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-display font-bold text-ink">Expenses</h2>
            <Link href={`/groups/${id}/expenses/new`} className="btn-primary-sm px-4 py-2">
              + Add Expense
            </Link>
          </div>

          {expenses.length === 0 ? (
            <div className="card border-dashed px-6 py-10 text-center">
              <p className="text-sm text-ink-secondary mb-3">No expenses yet.</p>
              <Link href={`/groups/${id}/expenses/new`} className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
                Add the first expense
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div key={expense.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-ink truncate">
                        {expense.category && CATEGORY_ICONS[expense.category]
                          ? `${CATEGORY_ICONS[expense.category]} `
                          : ''}
                        {expense.description}
                      </p>
                      <p className="text-xs text-ink-muted mt-1 flex flex-wrap items-center gap-x-1.5">
                        <span>
                          Paid by{' '}
                          <span className="text-ink-secondary font-medium">
                            {expense.paid_by === user.id ? 'You' : (nameCache.get(expense.paid_by) || expense.paid_by.slice(0, 8))}
                          </span>
                        </span>
                        {expense.category && (
                          <><span className="text-ink-muted">·</span><span className="capitalize">{expense.category}</span></>
                        )}
                        <span className="text-ink-muted">·</span>
                        <span>
                          {new Date(expense.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-ink-muted">·</span>
                        <span className="capitalize">{expense.split_type} split</span>
                        {expense.splits.length > 0 && (
                          <><span className="text-ink-muted">·</span><span>{expense.splits.length} people</span></>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="font-semibold text-sm text-ink text-currency">
                        {fmt(expense.amount, expense.currency)}
                      </p>
                      {expense.created_by === user.id && (
                        <DeleteExpenseButton expenseId={expense.id} groupId={id} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Settlement History */}
        {settlements.length > 0 && (
          <section className="opacity-0 animate-fade-up stagger-3">
            <h2 className="text-base font-display font-bold text-ink mb-3">Settlement History</h2>
            <div className="space-y-2">
              {settlements.map((s) => {
                const payerName = s.payer_id === user.id ? 'You' : (nameCache.get(s.payer_id) || s.payer_id.slice(0, 8));
                const payeeName = s.payee_id === user.id ? 'You' : (nameCache.get(s.payee_id) || s.payee_id.slice(0, 8));
                const statusColors: Record<string, string> = {
                  pending: 'bg-gold-light text-gold',
                  confirmed: 'bg-success-light text-success',
                  disputed: 'bg-danger-light text-danger',
                };
                return (
                  <div key={s.id} className="card px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-ink">
                          <span className="font-medium">{payerName}</span>
                          {' paid '}
                          <span className="font-medium">{payeeName}</span>
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                          <span>
                            {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                          {s.note && (
                            <><span>·</span><span>{s.note}</span></>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink text-currency">
                          {fmt(s.amount, s.currency)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColors[s.status] || 'bg-surface-sunken text-ink-muted'}`}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
