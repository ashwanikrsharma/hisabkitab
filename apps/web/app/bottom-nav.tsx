'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        {active ? (
          <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 01-.53 1.28h-1.44v7.44a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-7.44H4.31a.75.75 0 01-.53-1.28l8.69-8.69z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        )}
      </svg>
    ),
  },
  {
    href: '/groups',
    label: 'Groups',
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        {active ? (
          <path d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 17.243A11.917 11.917 0 0112 15.75c2.06 0 4.013.52 5.69 1.493a7.486 7.486 0 01-11.38 0zM17.846 15.968A8.972 8.972 0 0120.25 19.5c.5 0 1-.065 1.477-.19A5.985 5.985 0 0018 13.5a5.96 5.96 0 00-.154 2.468zM3.75 19.5c0-.63.093-1.237.265-1.81A5.973 5.973 0 002.52 19.31c.477.125.977.19 1.477.19z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        )}
      </svg>
    ),
  },
  {
    href: '/activity',
    label: 'Activity',
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        {active ? (
          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        {active ? (
          <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-2.54-.636A6.735 6.735 0 0012 17.25a6.735 6.735 0 00-4.145 1.211A8.25 8.25 0 0112 3.75a8.25 8.25 0 014.145 14.711zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        )}
      </svg>
    ),
  },
];

const FAB_ACTIONS = [
  {
    href: '/expenses/new',
    label: 'Add Expense',
    sublabel: 'Split with friends',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    href: '/groups',
    label: 'Group Expense',
    sublabel: 'Within a group',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

// Hide bottom nav on these paths (login, auth)
const HIDDEN_PATHS = ['/', '/login', '/auth'];

export function BottomNav() {
  const pathname = usePathname();
  const [fabOpen, setFabOpen] = useState(false);
  const hidden = pathname === '/' || HIDDEN_PATHS.some((p) => p !== '/' && pathname.startsWith(p));

  // Close FAB on route change
  useEffect(() => {
    setFabOpen(false);
  }, [pathname]);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setFabOpen(false);
  }, []);

  useEffect(() => {
    if (fabOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [fabOpen, handleKeyDown]);

  if (hidden) return null;

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Scrim / backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
          onClick={() => setFabOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* FAB + speed-dial menu — single container so menu sits directly above FAB */}
      <div className="fixed z-[60] right-4 bottom-20 flex flex-col-reverse items-end gap-4 safe-bottom">
        {/* FAB button */}
        <button
          type="button"
          onClick={() => setFabOpen((prev) => !prev)}
          aria-label={fabOpen ? 'Close menu' : 'New action'}
          aria-expanded={fabOpen}
          className={`w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-warm-xl transition-all duration-300 ease-out-expo active:scale-90 ${
            fabOpen ? 'rotate-45 bg-ink' : 'hover:shadow-glow hover:scale-105'
          }`}
          style={{ willChange: 'transform' }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        {/* Speed-dial actions (rendered above FAB via column-reverse) */}
        {fabOpen && (
          <div className="flex flex-col items-end gap-3 pb-1">
            {FAB_ACTIONS.map((action, i) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setFabOpen(false)}
                className="flex items-center gap-3 opacity-0 animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="bg-surface-raised rounded-xl shadow-warm-lg px-4 py-2.5 border border-gray-200/60">
                  <p className="text-sm font-semibold text-ink">{action.label}</p>
                  <p className="text-[11px] text-ink-muted">{action.sublabel}</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-surface-raised shadow-warm-lg border border-gray-200/60 flex items-center justify-center text-accent flex-shrink-0">
                  {action.icon}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav bar (no center action) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200/60 bg-surface-raised/90 backdrop-blur-xl safe-bottom" role="navigation" aria-label="Main navigation">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 h-16">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl transition-colors ${
                  active ? 'text-accent' : 'text-ink-muted'
                }`}
              >
                <div className="relative">
                  {item.icon(active)}
                </div>
                <span className={`text-[10px] font-semibold ${active ? 'text-accent' : 'text-ink-muted'}`}>
                  {item.label}
                </span>
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
