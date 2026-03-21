import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });
const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null });

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

// Mock Next.js navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

// Import after mocks
import LoginPage from './page';

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.origin for OAuth redirect
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
    });
  });

  it('renders "Continue with Google" button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders "Try with test account" button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Try with test account')).toBeInTheDocument();
  });

  it('renders HisabKitab branding', () => {
    render(<LoginPage />);
    expect(screen.getByText('HisabKitab')).toBeInTheDocument();
    expect(screen.getByText('Split expenses, not friendships')).toBeInTheDocument();
  });

  it('does NOT render email/password form', () => {
    render(<LoginPage />);
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Password')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in with Email')).not.toBeInTheDocument();
  });

  it('does NOT render phone OTP form', () => {
    render(<LoginPage />);
    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    expect(screen.queryByText('Send OTP')).not.toBeInTheDocument();
    expect(screen.queryByText('Verify OTP')).not.toBeInTheDocument();
  });

  it('calls signInWithOAuth with google provider when Google button is clicked', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText('Continue with Google'));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
      },
    });
  });

  it('calls signInWithPassword with test credentials when test button is clicked', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText('Try with test account'));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@hisabkitab.app',
      password: 'test1234',
    });
  });

  it('shows error message when Google login fails', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      error: { message: 'Google auth not configured' },
    });
    render(<LoginPage />);
    fireEvent.click(screen.getByText('Continue with Google'));
    // Wait for error to appear
    const errorEl = await screen.findByText('Google auth not configured');
    expect(errorEl).toBeInTheDocument();
  });

  it('renders Google logo SVG', () => {
    render(<LoginPage />);
    const googleButton = screen.getByText('Continue with Google').closest('button');
    expect(googleButton).toBeInTheDocument();
    const svg = googleButton?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
