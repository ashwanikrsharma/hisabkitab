import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import MobilePage from './page';

const DOWNLOAD_URL =
  'https://drive.google.com/uc?export=download&id=1ypl2yxz8TH1Z5EnunA2JmfJnj48O8Y8v';
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(DOWNLOAD_URL)}`;

describe('Mobile Download Page', () => {
  it('should render "Get HisabKitab on Android" heading', () => {
    render(<MobilePage />);
    expect(screen.getByText('Get HisabKitab on Android')).toBeInTheDocument();
  });

  it('should render QR code image with correct src and alt text', () => {
    render(<MobilePage />);
    const img = screen.getByAltText('QR code to download HisabKitab Android app');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', QR_CODE_URL);
  });

  it('should render "Download APK" link with correct href', () => {
    render(<MobilePage />);
    const link = screen.getByText('Download APK').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', DOWNLOAD_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render "Back to HisabKitab" link pointing to home', () => {
    render(<MobilePage />);
    const backLink = screen.getByText(/Back to HisabKitab/);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('should render HisabKitab branding in navigation', () => {
    render(<MobilePage />);
    expect(screen.getByText('HisabKitab')).toBeInTheDocument();
  });
});
