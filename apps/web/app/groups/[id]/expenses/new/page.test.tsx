import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewExpensePage from './page';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useParams: () => ({ id: 'group-456' }),
  useSearchParams: () => new URLSearchParams(),
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

function mockFetchResponses(...responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
  const fn = global.fetch as ReturnType<typeof vi.fn>;
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NewExpensePage (group)', () => {
  it('calls router.push and router.refresh after creating an expense', async () => {
    const user = userEvent.setup();

    // 1st fetch: GET members, 2nd fetch: GET group, 3rd fetch: POST expense
    mockFetchResponses(
      {
        ok: true,
        json: async () => ({
          members: [
            { id: 'm1', user_id: 'user-a', role: 'admin', users: { id: 'user-a', name: 'Alice' } },
            { id: 'm2', user_id: 'user-b', role: 'member', users: { id: 'user-b', name: 'Bob' } },
          ],
        }),
      },
      { ok: true, json: async () => ({ group: { currency: 'INR' } }) },
      { ok: true, json: async () => ({ expense: { id: 'exp-1' } }) },
    );

    render(<NewExpensePage />);

    // Wait for loading to finish
    // Wait for members to load (loading spinner disappears, form renders)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Dinner at restaurant')).toBeInTheDocument();
    });

    // Fill the form
    await user.type(screen.getByPlaceholderText('e.g. Dinner at restaurant'), 'Team lunch');
    await user.type(screen.getByPlaceholderText('0.00'), '500');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /^Add Expense$/ }));

    // Verify navigation and refresh
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/groups/group-456');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('does NOT navigate or refresh when expense creation fails', async () => {
    const user = userEvent.setup();

    mockFetchResponses(
      {
        ok: true,
        json: async () => ({
          members: [
            { id: 'm1', user_id: 'user-a', role: 'admin', users: { id: 'user-a', name: 'Alice' } },
          ],
        }),
      },
      { ok: true, json: async () => ({ group: { currency: 'INR' } }) },
      { ok: false, json: async () => ({ error: 'Failed to create expense' }) },
    );

    render(<NewExpensePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Dinner at restaurant')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('e.g. Dinner at restaurant'), 'Dinner');
    await user.type(screen.getByPlaceholderText('0.00'), '100');

    await user.click(screen.getByRole('button', { name: /^Add Expense$/ }));

    await waitFor(() => {
      expect(screen.getByText('Failed to create expense')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
