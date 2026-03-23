'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';

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

type UserProfile = {
  id: string;
  name: string;
  phone: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Form state
  const [name, setName] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = (await res.json()) as { user: UserProfile };
        setProfile(data.user);
        setName(data.user.name ?? '');
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  const isDirty =
    profile !== null &&
    name !== (profile.name ?? '');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        const message = typeof body.error === 'string' ? body.error : 'Failed to save profile.';
        toast.error(message);
        return;
      }

      const data = (await res.json()) as { user: UserProfile };
      setProfile(data.user);
      setName(data.user.name ?? '');
      toast.success('Profile updated');
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      toast.error('Failed to sign out');
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile?.name || '';
  const initials = displayName.slice(0, 2).toUpperCase() || '?';

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
          <h1 className="text-lg font-display font-bold text-white">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 flex flex-col min-h-[calc(100vh-64px)]">
        {/* Profile hero */}
        <section className="flex flex-col items-center gap-3 opacity-0 animate-fade-up">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${avatarColor(displayName)} flex items-center justify-center text-white text-2xl font-bold shadow-warm-lg`}>
            {initials}
          </div>
          <div className="text-center">
            <p className="text-lg font-display font-bold text-ink">{displayName || 'No name set'}</p>
            {profile?.phone && (
              <p className="text-sm text-ink-secondary mt-0.5">{profile.phone}</p>
            )}
          </div>
        </section>

        {/* Edit form */}
        <section className="opacity-0 animate-fade-up stagger-1">
          <div className="card p-6">
            <h2 className="text-sm font-display font-bold text-ink mb-4">Edit Profile</h2>

            <form onSubmit={handleSave} noValidate className="space-y-5">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium text-ink mb-1.5">
                  Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  disabled={saving}
                  className="input-field"
                />
              </div>

              <button
                type="submit"
                data-testid="save-profile"
                disabled={saving || !isDirty}
                className={`btn-primary w-full transition-all ${
                  !isDirty && !saving
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </section>

        {/* Sign out */}
        <section className="opacity-0 animate-fade-up stagger-2 mt-auto pt-8">
          <div className="card p-6">
            <h2 className="text-sm font-display font-bold text-danger mb-2">Sign Out</h2>
            <p className="text-xs text-ink-secondary mb-4">
              You will need to sign in again to access your account.
            </p>
            <button
              type="button"
              data-testid="sign-out"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full rounded-xl border-2 border-danger/20 bg-danger-light text-danger font-semibold text-sm py-3 px-4 hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
