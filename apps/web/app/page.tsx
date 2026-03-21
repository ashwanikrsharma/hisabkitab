import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LandingPage() {
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
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background decorations — bolder, warmer */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="absolute top-1/3 -left-60 w-[600px] h-[600px] rounded-full bg-gold/[0.05] blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] rounded-full bg-success/[0.05] blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-warm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7v4m0 0v4m0-4h2.5M12 11H9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-display font-bold text-ink tracking-tight">HisabKitab</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-ink-secondary hover:text-ink transition-colors px-4 py-2">
              Log in
            </Link>
            <Link href="/login" className="btn-primary px-5 py-2 text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mx-auto text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-accent text-white mb-8 shadow-warm-xl opacity-0 animate-scale-in">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7v4m0 0v4m0-4h2.5M12 11H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Tagline badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-light border border-accent/10 px-4 py-1.5 mb-6 opacity-0 animate-fade-up">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-semibold text-accent">AI-powered expense splitting</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-ink tracking-tight leading-[1.1] opacity-0 animate-fade-up stagger-1">
              Split expenses,
              <br />
              <span className="text-accent">not friendships.</span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-lg sm:text-xl text-ink-secondary leading-relaxed max-w-lg mx-auto opacity-0 animate-fade-up stagger-2">
              The smartest way to track group expenses, settle debts, and keep every paisa accounted for.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-up stagger-3">
              <Link href="/login" className="btn-primary px-8 py-3.5 text-base shadow-warm-lg hover:shadow-warm-xl hover:scale-[1.02] w-full sm:w-auto">
                Start for free
              </Link>
              <Link href="/login" className="btn-secondary px-8 py-3.5 text-base w-full sm:w-auto">
                I have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="relative z-10 px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Feature 1 */}
            <div className="card p-6 sm:p-8 opacity-0 animate-fade-up stagger-3">
              <div className="w-12 h-12 rounded-2xl bg-gold/10 text-gold flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-ink text-lg mb-2">AI-Powered Parsing</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Just type or snap a photo of a bill. Our AI extracts amounts, splits, and categorizes expenses instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card p-6 sm:p-8 opacity-0 animate-fade-up stagger-4">
              <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-ink text-lg mb-2">Smart Settlements</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Minimized transactions across groups. Instead of 10 payments, settle everything with just 3.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card p-6 sm:p-8 opacity-0 animate-fade-up stagger-5">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-ink text-lg mb-2">Built for Groups</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Flatmates, trips, events, office lunches — manage any group with real-time balance tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink text-center mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 text-xl font-display font-bold">
                1
              </div>
              <h3 className="font-display font-semibold text-ink mb-2">Create a group</h3>
              <p className="text-sm text-ink-secondary">Add your friends, flatmates, or travel buddies to a shared group.</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-gold/10 text-gold flex items-center justify-center mx-auto mb-4 text-xl font-display font-bold">
                2
              </div>
              <h3 className="font-display font-semibold text-ink mb-2">Add expenses</h3>
              <p className="text-sm text-ink-secondary">Log bills as they happen. AI handles the math and splits automatically.</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4 text-xl font-display font-bold">
                3
              </div>
              <h3 className="font-display font-semibold text-ink mb-2">Settle up</h3>
              <p className="text-sm text-ink-secondary">See who owes what with one tap. Minimal transactions, maximum clarity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Built for India callout */}
      <section className="relative z-10 px-6 pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto">
          <div className="card p-8 sm:p-10 text-center bg-gradient-to-br from-surface-raised to-accent-light/30 border-accent/10">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold-light border border-gold/20 px-4 py-1.5 mb-5">
              <span className="text-xs font-semibold text-gold">Made for India</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-3">
              Every paisa, accounted for.
            </h2>
            <p className="text-ink-secondary max-w-md mx-auto leading-relaxed">
              INR-first, UPI-friendly, and designed for how Indians actually split bills — from chai runs to Goa trips.
            </p>
            <div className="mt-8">
              <Link href="/login" className="btn-primary px-8 py-3.5 text-base shadow-warm-lg">
                Get started free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 pb-8 pt-6 border-t border-gray-200/60">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7v4m0 0v4m0-4h2.5M12 11H9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-display font-semibold text-ink-secondary">HisabKitab</span>
          </div>
          <p className="text-xs text-ink-muted">Split expenses, not friendships.</p>
        </div>
      </footer>
    </div>
  );
}
