import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock the supabase client used by handleSignOut
const mockSignOut = vi.fn().mockResolvedValue({});
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

import ProfilePage from './page';

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  phone: '+919876543210',
  upi_id: 'testuser@upi',
  default_currency: 'INR',
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

function mockProfileFetch() {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ user: mockUser }),
  });
}

describe('Profile Page', () => {
  it('should render Profile heading after loading', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  it('should render name input with fetched value', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name');
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue('Test User');
    });
  });

  it('should render UPI ID input with fetched value', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      const upiInput = screen.getByLabelText('UPI ID');
      expect(upiInput).toBeInTheDocument();
      expect(upiInput).toHaveValue('testuser@upi');
    });
  });

  it('should render currency selector with fetched value', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      const currencySelect = screen.getByLabelText('Default Currency');
      expect(currencySelect).toBeInTheDocument();
      expect(currencySelect).toHaveValue('INR');
    });
  });

  it('should render Sign Out button', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    });
  });

  it('should render Save Changes button as disabled when no changes are made', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  it('should redirect to login when profile fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should display user initials in avatar', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('TE')).toBeInTheDocument();
    });
  });

  it('should display user phone number', async () => {
    mockProfileFetch();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('+919876543210')).toBeInTheDocument();
    });
  });
});
