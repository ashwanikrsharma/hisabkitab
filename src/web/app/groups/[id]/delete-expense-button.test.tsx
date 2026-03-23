import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteExpenseButton } from './delete-expense-button';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  // Auto-confirm all dialogs
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('DeleteExpenseButton', () => {
  it('calls router.refresh() after successful deletion', async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    render(<DeleteExpenseButton expenseId="exp-1" groupId="grp-1" />);

    await user.click(screen.getByTitle('Delete expense'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/expenses/exp-1', { method: 'DELETE' });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows error and does NOT refresh on failed deletion', async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'You can only delete expenses you created' }),
    });

    render(<DeleteExpenseButton expenseId="exp-1" groupId="grp-1" />);

    await user.click(screen.getByTitle('Delete expense'));

    await waitFor(() => {
      expect(screen.getByText('You can only delete expenses you created')).toBeInTheDocument();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not call fetch when user cancels confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<DeleteExpenseButton expenseId="exp-1" groupId="grp-1" />);

    await user.click(screen.getByTitle('Delete expense'));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
