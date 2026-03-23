'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

const DOWNLOAD_URL =
  'https://drive.google.com/uc?export=download&id=1ypl2yxz8TH1Z5EnunA2JmfJnj48O8Y8v';
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(DOWNLOAD_URL)}`;

type AndroidAppBadgeProps = {
  variant: 'landing' | 'dashboard';
};

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.523 2.236a.5.5 0 0 0-.862.509l1.08 1.834A6.973 6.973 0 0 0 12 2.5a6.973 6.973 0 0 0-5.741 2.08l1.08-1.835a.5.5 0 1 0-.862-.509L5.17 4.636A7.476 7.476 0 0 0 4.5 9h15a7.476 7.476 0 0 0-.67-4.364l-1.307-2.4ZM8.5 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM5 10a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1Zm14 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1ZM6 10v8a2 2 0 0 0 2 2h1v2.5a1.5 1.5 0 0 0 3 0V20h0v2.5a1.5 1.5 0 0 0 3 0V20h1a2 2 0 0 0 2-2v-8H6Z" />
    </svg>
  );
}

export function AndroidAppBadge({ variant }: AndroidAppBadgeProps) {
  const [qrError, setQrError] = useState(false);

  const badge = (
    <Dialog.Trigger asChild>
      <button
        type="button"
        data-testid="android-app-badge"
        className="inline-flex items-center gap-2 rounded-full bg-success/10 border border-success/20 px-4 py-2 text-sm font-semibold text-success hover:bg-success/15 transition-colors cursor-pointer"
      >
        <AndroidIcon className="w-4 h-4" />
        Get Android App
      </button>
    </Dialog.Trigger>
  );

  const modal = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content className="card max-w-sm w-full p-6 animate-scale-in relative">
          <Dialog.Close asChild>
            <button
              type="button"
              data-testid="android-modal-close"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>

          <Dialog.Title className="text-lg font-display font-bold text-ink">
            Get the Android App
          </Dialog.Title>
          <Dialog.Description className="text-sm text-ink-secondary mt-1">
            Scan this QR code with your phone camera to download the app.
          </Dialog.Description>

          <div className="mt-5 flex flex-col items-center gap-4">
            {!qrError && (
              <div className="w-[200px] h-[200px] rounded-xl overflow-hidden bg-surface-sunken flex items-center justify-center">
                <img
                  src={QR_CODE_URL}
                  width={200}
                  height={200}
                  alt="QR code to download the HisabKitab Android app"
                  loading="lazy"
                  onError={() => setQrError(true)}
                  data-testid="android-qr-code"
                />
              </div>
            )}

            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="android-download-link"
              className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              Or tap here to download directly
            </a>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              data-testid="android-modal-close-btn"
              className="btn-secondary w-full mt-4"
            >
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </div>
    </Dialog.Portal>
  );

  if (variant === 'dashboard') {
    return (
      <Dialog.Root>
        <div className="card px-4 py-3 flex items-center justify-between opacity-0 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/10 text-success flex items-center justify-center">
              <AndroidIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Android app available</p>
              <p className="text-xs text-ink-secondary">Install for the best experience</p>
            </div>
          </div>
          {badge}
        </div>
        {modal}
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root>
      {badge}
      {modal}
    </Dialog.Root>
  );
}
