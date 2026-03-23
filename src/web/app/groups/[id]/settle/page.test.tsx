import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettlePage from './page';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useParams: () => ({ id: 'group-789' }),
  useSearchParams: () => {
    const params = new URLSearchParams({
      payee: 'user-payee',
      amount: '250',
      name: 'Priya',
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

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('SettlePage (group)', () => {
  it('calls router.push and router.refresh after successful settlement', async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ settlement: { id: 's-1' } }),
    });

    render(<SettlePage />);

    // The amount should be prefilled from search params
    const submitButton = screen.getByRole('button', { name: 'Record Payment' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/groups/group-789');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows error and does NOT navigate on failed settlement', async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to create settlement' }),
    });

    render(<SettlePage />);

    await user.click(screen.getByRole('button', { name: 'Record Payment' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to create settlement')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('sends paymentMethod in the request body', async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ settlement: { id: 's-1' } }),
    });

    render(<SettlePage />);

    // Select "Cash" payment method
    const cashButton = screen.getByRole('button', { name: 'Cash' });
    await user.click(cashButton);

    await user.click(screen.getByRole('button', { name: 'Record Payment' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settlements', expect.objectContaining({
        method: 'POST',
      }));
    });

    // Verify the request body includes paymentMethod
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse((fetchCall[1] as RequestInit).body as string);
    expect(body.paymentMethod).toBe('cash');
    // UPI transaction ID should not be sent when method is cash
    expect(body.upiTransactionId).toBeUndefined();
  });
});
