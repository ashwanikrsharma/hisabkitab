import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => {
    const params = new URLSearchParams({
      payee: 'user-payee',
      amount: '500',
      name: 'Rahul',
      currency: 'INR',
    });
    return params;
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import SettlePage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('Direct Settle Page', () => {
  it('should render amount input with prefilled value from search params', () => {
    render(<SettlePage />);
    const amountInput = screen.getByLabelText(/Amount/);
    expect(amountInput).toBeInTheDocument();
    expect(amountInput).toHaveValue(500);
  });

  it('should render payment method buttons for UPI, Cash, and Bank Transfer', () => {
    render(<SettlePage />);
    expect(screen.getByRole('button', { name: 'UPI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cash' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bank Transfer' })).toBeInTheDocument();
  });

  it('should render Record Payment submit button', () => {
    render(<SettlePage />);
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument();
  });

  it('should display payee name from search params', () => {
    render(<SettlePage />);
    expect(screen.getByText('Rahul')).toBeInTheDocument();
  });

  it('should render note input', () => {
    render(<SettlePage />);
    expect(screen.getByLabelText(/Note/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Paid via Google Pay')).toBeInTheDocument();
  });

  it('should call router.push and router.refresh after successful settlement', async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ settlement: { id: 's-1' } }),
    });

    render(<SettlePage />);

    await user.click(screen.getByRole('button', { name: 'Record Payment' }));

    expect(mockPush).toHaveBeenCalledWith('/friends/user-payee');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should render Cancel link pointing to friend page', () => {
    render(<SettlePage />);
    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/friends/user-payee');
  });
});
