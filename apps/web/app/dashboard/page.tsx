import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserGroups, getGroupBalances, getUserActivity, getDirectBalances, getUserProfile } from '@hisabkitab/db';
import type { Group, BalanceSummary, Activity, DirectBalanceSummary } from '@hisabkitab/db';
import { ProfileAvatar } from './profile-avatar';
import { AndroidAppBadge } from '@/components/android-app-badge';

export const revalidate = 60;

export default async function DashboardPage() {
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

  const [groupsResult, activitiesResult, userProfileResult, directBalancesResult] = await Promise.allSettled([
    getUserGroups(user.id),
    getUserActivity(user.id, { limit: 10 }),
    getUserProfile(user.id),
    getDirectBalances(user.id),
  ]);

  const groups: Group[] = groupsResult.status === 'fulfilled' ? groupsResult.value : (() => { console.error('[DashboardPage] getUserGroups failed:', (groupsResult as PromiseRejectedResult).reason); return []; })();
  const activities: Activity[] = activitiesResult.status === 'fulfilled' ? activitiesResult.value : (() => { console.error('[DashboardPage] getUserActivity failed:', (activitiesResult as PromiseRejectedResult).reason); return []; })();
  const userProfile: { name: string } | null = userProfileResult.status === 'fulfilled' ? userProfileResult.value : (() => { console.error('[DashboardPage] getUserProfile failed:', (userProfileResult as PromiseRejectedResult).reason); return null; })();
  const directBalanceSummary: DirectBalanceSummary | null = directBalancesResult.status === 'fulfilled' ? directBalancesResult.value : (() => { console.error('[DashboardPage] getDirectBalances failed:', (directBalancesResult as PromiseRejectedResult).reason); return null; })();

  const balanceResults = await Promise.allSettled(
    groups.map((g) => getGroupBalances(g.id)),
  );

  const groupBalances: BalanceSummary[] = balanceResults
    .filter((r): r is PromiseFulfilledResult<BalanceSummary> => r.status === 'fulfilled')
    .map((r) => r.value);

  type PersonSummary = {
    name: string;
    youOwe: number;
    owesYou: number;
    currency: string;
  };

  const personMap = new Map<string, PersonSummary>();

  for (const bs of groupBalances) {
    for (const debt of bs.simplifiedDebts) {
      if (debt.fromUserId === user.id) {
        const existing = personMap.get(debt.toUserId);
        if (existing) {
          existing.youOwe += debt.amount;
        } else {
          personMap.set(debt.toUserId, { name: debt.toName, youOwe: debt.amount, owesYou: 0, currency: bs.currency });
        }
      } else if (debt.toUserId === user.id) {
        const existing = personMap.get(debt.fromUserId);
        if (existing) {
          existing.owesYou += debt.amount;
        } else {
          personMap.set(debt.fromUserId, { name: debt.fromName, youOwe: 0, owesYou: debt.amount, currency: bs.currency });
        }
      }
    }
  }

  // Merge direct (groupless) debts into personMap
  if (directBalanceSummary) {
    for (const debt of directBalanceSummary.simplifiedDebts) {
      if (debt.fromUserId === user.id) {
        const existing = personMap.get(debt.toUserId);
        if (existing) {
          existing.youOwe += debt.amount;
        } else {
          personMap.set(debt.toUserId, { name: debt.toName, youOwe: debt.amount, owesYou: 0, currency: directBalanceSummary.currency });
        }
      } else if (debt.toUserId === user.id) {
        const existing = personMap.get(debt.fromUserId);
        if (existing) {
          existing.owesYou += debt.amount;
        } else {
          personMap.set(debt.fromUserId, { name: debt.fromName, youOwe: 0, owesYou: debt.amount, currency: directBalanceSummary.currency });
        }
      }
    }
  }

  const people = Array.from(personMap.entries()).sort((a, b) => (b[1].youOwe + b[1].owesYou) - (a[1].youOwe + a[1].owesYou));
  const totalYouOwe = people.reduce((sum, [, p]) => sum + p.youOwe, 0);
  const totalOwedToYou = people.reduce((sum, [, p]) => sum + p.owesYou, 0);

  type GroupSettlement = {
    group: Group;
    debts: BalanceSummary['simplifiedDebts'];
    currency: string;
  };

  const groupSettlements: GroupSettlement[] = [];
  for (const bs of groupBalances) {
    const group = groups.find((g) => g.id === bs.groupId);
    if (!group) continue;
    const myDebts = bs.simplifiedDebts.filter(
      (d) => d.fromUserId === user.id || d.toUserId === user.id,
    );
    if (myDebts.length > 0) {
      groupSettlements.push({ group, debts: myDebts, currency: bs.currency });
    }
  }

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);

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

  return (
    <div className="min-h-screen pb-nav">
      {/* Header */}
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-display font-bold text-white tracking-tight">HisabKitab</h1>
          </div>
          <ProfileAvatar name={userProfile?.name ?? ''} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <AndroidAppBadge variant="dashboard" />

        {/* Summary cards */}
        <section className="grid grid-cols-2 gap-3 opacity-0 animate-fade-up">
          <div className="summary-card-owe">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-danger animate-subtle-pulse" />
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">You owe</p>
            </div>
            <p className="text-2xl font-display font-bold text-danger text-currency">
              {fmt(totalYouOwe, 'INR')}
            </p>
          </div>
          <div className="summary-card-owed">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-success animate-subtle-pulse" />
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">You are owed</p>
            </div>
            <p className="text-2xl font-display font-bold text-success text-currency">
              {fmt(totalOwedToYou, 'INR')}
            </p>
          </div>
        </section>

        {/* People */}
        <section className="opacity-0 animate-fade-up stagger-1">
          <h2 className="text-base font-display font-bold text-ink mb-3">People</h2>

          {people.length === 0 ? (
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
              {people.map(([personId, person]) => {
                return (
                  <Link key={personId} href={`/friends/${personId}`} className="card card-hover px-4 py-3 flex items-center justify-between block">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(person.name)} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                        {person.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm text-ink">{person.name}</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      {person.youOwe > 0 && (
                        <p className="badge-owe text-currency">{fmt(person.youOwe, person.currency)}</p>
                      )}
                      {person.owesYou > 0 && (
                        <p className="badge-owed text-currency">{fmt(person.owesYou, person.currency)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Settlements by Group */}
        <section className="opacity-0 animate-fade-up stagger-2">
          <h2 className="text-base font-display font-bold text-ink mb-3">Settlements by Group</h2>

          {groupSettlements.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <p className="text-sm text-ink-secondary">No pending settlements.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupSettlements.map(({ group, debts, currency }) => (
                <div key={group.id} className="card overflow-hidden">
                  <Link
                    href={`/groups/${group.id}`}
                    className="flex items-center justify-between px-4 py-3 bg-surface-sunken/50 border-b border-gray-200/60 hover:bg-surface-sunken transition-colors"
                  >
                    <span className="font-display font-semibold text-sm text-ink">{group.name}</span>
                    <svg className="w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <div className="divide-y divide-gray-100">
                    {debts.map((debt, idx) => {
                      const iOwe = debt.fromUserId === user.id;
                      return (
                        <div key={idx} className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm text-ink-secondary">
                            {iOwe ? (
                              <>You owe <span className="font-medium text-ink">{debt.toName}</span></>
                            ) : (
                              <><span className="font-medium text-ink">{debt.fromName}</span> owes you</>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold text-currency ${iOwe ? 'text-danger' : 'text-success'}`}>
                              {fmt(debt.amount, currency)}
                            </span>
                            {iOwe && (
                              <Link
                                href={`/groups/${group.id}/settle?payee=${debt.toUserId}&amount=${debt.amount}&name=${encodeURIComponent(debt.toName)}&currency=${currency}`}
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="opacity-0 animate-fade-up stagger-3" data-testid="recent-activity">
          <h2 className="text-base font-display font-bold text-ink mb-3">Recent Activity</h2>

          {activities.length === 0 ? (
            <div className="card px-5 py-8 text-center">
              <p className="text-sm text-ink-secondary">No recent activity.</p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {activities.map((activity) => (
                <div key={activity.id} className="px-4 py-3 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    activity.type === 'expense_added' ? 'bg-accent/10 text-accent' :
                    activity.type === 'expense_deleted' ? 'bg-danger/10 text-danger' :
                    activity.type === 'settlement_created' ? 'bg-success/10 text-success' :
                    activity.type === 'group_created' ? 'bg-violet-100 text-violet-600' :
                    activity.type === 'group_renamed' ? 'bg-amber-100 text-amber-600' :
                    activity.type === 'group_archived' ? 'bg-gray-100 text-gray-500' :
                    'bg-sky-100 text-sky-600'
                  }`}>
                    {activity.type === 'expense_added' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    {activity.type === 'expense_deleted' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    {activity.type === 'settlement_created' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {(activity.type === 'group_created' || activity.type === 'group_renamed' || activity.type === 'group_archived') && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                    {activity.type === 'member_joined' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{activity.title}</p>
                    <p className="text-xs text-ink-secondary mt-0.5 truncate">{activity.description}</p>
                    <p className="text-xs text-ink-muted mt-1">
                      {new Date(activity.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
