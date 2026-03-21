import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddMemberPage from './page';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useParams: () => ({ id: 'group-123' }),
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchResponses(...responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
  const fn = global.fetch as ReturnType<typeof vi.fn>;
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AddMemberPage', () => {
  it('calls router.refresh() after successfully adding a member', async () => {
    const user = userEvent.setup();

    // 1st fetch: load existing members
    // 2nd fetch: search users
    // 3rd fetch: POST add member
    mockFetchResponses(
      { ok: true, json: async () => ({ members: [] }) },
      { ok: true, json: async () => ({ users: [{ id: 'user-abc', name: 'Rahul', phone: '9876543210' }] }) },
      { ok: true, json: async () => ({ member: { id: 'member-1', user_id: 'user-abc' } }) },
    );

    render(<AddMemberPage />);

    // Wait for initial member fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/groups/group-123/members');
    });

    // Type in search and click Search
    const searchInput = screen.getByPlaceholderText('e.g. Rahul or 98765...');
    await user.type(searchInput, 'Rahul');
    const searchButton = screen.getByRole('button', { name: 'Search' });
    await user.click(searchButton);

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Rahul')).toBeInTheDocument();
    });

    // Click "Add" button
    const addButton = screen.getByRole('button', { name: 'Add' });
    await user.click(addButton);

    // Verify router.refresh() was called
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    // Verify success message
    expect(screen.getByText('Rahul added to the group!')).toBeInTheDocument();
  });

  it('does NOT call router.refresh() when adding a member fails', async () => {
    const user = userEvent.setup();

    mockFetchResponses(
      { ok: true, json: async () => ({ members: [] }) },
      { ok: true, json: async () => ({ users: [{ id: 'user-abc', name: 'Rahul', phone: '9876543210' }] }) },
      { ok: false, json: async () => ({ error: 'Not a member of this group' }) },
    );

    render(<AddMemberPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/groups/group-123/members');
    });

    const searchInput = screen.getByPlaceholderText('e.g. Rahul or 98765...');
    await user.type(searchInput, 'Rahul');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Rahul')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Not a member of this group')).toBeInTheDocument();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('shows already-added member as "Member" badge after adding', async () => {
    const user = userEvent.setup();

    mockFetchResponses(
      { ok: true, json: async () => ({ members: [] }) },
      { ok: true, json: async () => ({ users: [{ id: 'user-abc', name: 'Rahul', phone: '9876543210' }] }) },
      { ok: true, json: async () => ({ member: { id: 'member-1', user_id: 'user-abc' } }) },
    );

    render(<AddMemberPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/groups/group-123/members');
    });

    const searchInput = screen.getByPlaceholderText('e.g. Rahul or 98765...');
    await user.type(searchInput, 'Rahul');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Rahul')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add' }));

    // After adding, the user should show "Member" badge instead of "Add" button
    await waitFor(() => {
      expect(screen.getByText('Member')).toBeInTheDocument();
    });
  });
});
