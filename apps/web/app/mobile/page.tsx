import Link from 'next/link';

const DOWNLOAD_URL =
  'https://drive.google.com/uc?export=download&id=1ypl2yxz8TH1Z5EnunA2JmfJnj48O8Y8v';
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(DOWNLOAD_URL)}`;

export default function MobilePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-success/[0.06] blur-3xl" />
        <div className="absolute top-1/3 -left-60 w-[600px] h-[600px] rounded-full bg-accent/[0.05] blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-warm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7v4m0 0v4m0-4h2.5M12 11H9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-display font-bold text-ink tracking-tight">HisabKitab</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <section className="relative z-10 px-6 pt-12 pb-20">
        <div className="max-w-sm mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 text-success mb-6 opacity-0 animate-scale-in">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink tracking-tight opacity-0 animate-fade-up">
            Get HisabKitab on Android
          </h1>
          <p className="mt-3 text-ink-secondary leading-relaxed opacity-0 animate-fade-up stagger-1">
            Scan the QR code with your phone camera to download the app, or tap the button below.
          </p>

          {/* QR Code Card */}
          <div className="card p-8 mt-8 opacity-0 animate-fade-up stagger-2">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={QR_CODE_URL}
                alt="QR code to download HisabKitab Android app"
                width={240}
                height={240}
                className="rounded-xl"
              />
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Point your phone camera at the QR code
            </p>
          </div>

          {/* Download Button */}
          <div className="mt-6 opacity-0 animate-fade-up stagger-3">
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-base shadow-warm-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download APK
            </a>
          </div>

          {/* Back link */}
          <div className="mt-8 opacity-0 animate-fade-up stagger-4">
            <Link href="/" className="text-sm font-semibold text-ink-secondary hover:text-ink transition-colors">
              ← Back to HisabKitab
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
