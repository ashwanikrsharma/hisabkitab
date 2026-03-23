import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AndroidAppBadge } from './android-app-badge';

// Radix Dialog Portal renders content in the DOM but may need a container
// jsdom supports this out of the box

describe('AndroidAppBadge', () => {
  it('should render "Get Android App" text for landing variant', () => {
    render(<AndroidAppBadge variant="landing" />);
    expect(screen.getByText('Get Android App')).toBeInTheDocument();
  });

  it('should render badge button with data-testid for landing variant', () => {
    render(<AndroidAppBadge variant="landing" />);
    expect(screen.getByTestId('android-app-badge')).toBeInTheDocument();
  });

  it('should render dashboard variant with "Android app available" text', () => {
    render(<AndroidAppBadge variant="dashboard" />);
    expect(screen.getByText('Android app available')).toBeInTheDocument();
    expect(screen.getByText('Install for the best experience')).toBeInTheDocument();
    expect(screen.getByTestId('android-app-badge')).toBeInTheDocument();
  });

  it('should open dialog with QR code when badge is clicked', async () => {
    const user = userEvent.setup();
    render(<AndroidAppBadge variant="landing" />);

    await user.click(screen.getByTestId('android-app-badge'));

    expect(screen.getByText('Get the Android App')).toBeInTheDocument();
    expect(screen.getByTestId('android-qr-code')).toBeInTheDocument();
  });

  it('should show download link in the dialog', async () => {
    const user = userEvent.setup();
    render(<AndroidAppBadge variant="landing" />);

    await user.click(screen.getByTestId('android-app-badge'));

    const downloadLink = screen.getByTestId('android-download-link');
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute(
      'href',
      'https://drive.google.com/uc?export=download&id=1ypl2yxz8TH1Z5EnunA2JmfJnj48O8Y8v',
    );
    expect(downloadLink).toHaveAttribute('target', '_blank');
  });

  it('should close dialog when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AndroidAppBadge variant="landing" />);

    await user.click(screen.getByTestId('android-app-badge'));
    expect(screen.getByText('Get the Android App')).toBeInTheDocument();

    await user.click(screen.getByTestId('android-modal-close-btn'));

    // Dialog title should no longer be visible after closing
    expect(screen.queryByText('Get the Android App')).not.toBeInTheDocument();
  });
});
