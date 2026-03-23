import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserActivity, getUserGroups } from '@hisabkitab/services';
import type { Activity, Group } from '@hisabkitab/services';

export const revalidate = 60;

const ACTIVITY_ICONS: Record<string, string> = {
  expense_added: '💰',
  expense_deleted: '🗑️',
  settlement_created: '✅',
  member_joined: '👋',
  group_created: '🎉',
};

export default async function ActivityPage() {
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

  let activities: Activity[] = [];
  let groups: Group[] = [];
  try {
    [activities, groups] = await Promise.all([
      getUserActivity(user.id, { limit: 100 }),
      getUserGroups(user.id),
    ]);
  } catch (err) {
    console.error('[ActivityPage] failed:', err);
  }

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // Group activities by date
  type DayGroup = { label: string; items: Activity[] };
  const dayGroups: DayGroup[] = [];
  let currentLabel = '';

  for (const a of activities) {
    const label = formatDayLabel(a.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      dayGroups.push({ label, items: [a] });
    } else {
      dayGroups[dayGroups.length - 1]!.items.push(a);
    }
  }

  return (
    <div className="min-h-screen pb-nav">
      <header className="glass-header px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-display font-bold text-white">Recent Activity</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {activities.length === 0 ? (
          <div className="card px-5 py-12 text-center opacity-0 animate-fade-up">
            <div className="w-14 h-14 rounded-2xl bg-surface-sunken text-ink-muted mx-auto mb-4 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-ink-secondary">No activity yet. Add an expense to get started!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dayGroups.map((day) => (
              <div key={day.label}>
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">
                  {day.label}
                </h3>
                <div className="space-y-1.5">
                  {day.items.map((a, i) => {
                    const group = a.group_id ? groupMap.get(a.group_id) : undefined;
                    return (
                      <Link
                        key={a.id}
                        href={a.group_id ? `/groups/${a.group_id}` : '/'}
                        className="card-hover px-4 py-3 block opacity-0 animate-fade-up"
                        style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg flex-shrink-0 mt-0.5">
                            {ACTIVITY_ICONS[a.type] || '📋'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink">{a.title}</p>
                            <p className="text-sm text-ink-secondary mt-0.5">{a.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {group && (
                                <span className="text-xs text-accent font-semibold">{group.name}</span>
                              )}
                              <span className="text-xs text-ink-muted">
                                {formatRelativeTime(a.created_at)}
                              </span>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-ink-muted flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-IN', { weekday: 'long' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
