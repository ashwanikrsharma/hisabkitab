import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import NewGroupPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('New Group Page', () => {
  it('should render group name input', () => {
    render(<NewGroupPage />);
    expect(screen.getByLabelText(/Group Name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Goa Trip, Flatmates, Office Lunch')).toBeInTheDocument();
  });

  it('should render Create Group button', () => {
    render(<NewGroupPage />);
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('should render Cancel link', () => {
    render(<NewGroupPage />);
    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink).toBeInTheDocument();
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/groups');
  });

  it('should disable Create Group button when name is empty', () => {
    render(<NewGroupPage />);
    const button = screen.getByRole('button', { name: 'Create Group' });
    expect(button).toBeDisabled();
  });

  it('should enable Create Group button when name is entered', async () => {
    const user = userEvent.setup();
    render(<NewGroupPage />);

    const nameInput = screen.getByPlaceholderText('e.g. Goa Trip, Flatmates, Office Lunch');
    await user.type(nameInput, 'Weekend Trip');

    const button = screen.getByRole('button', { name: 'Create Group' });
    expect(button).toBeEnabled();
  });

  it('should keep Create Group button disabled when name is only whitespace', async () => {
    const user = userEvent.setup();
    render(<NewGroupPage />);

    const nameInput = screen.getByPlaceholderText('e.g. Goa Trip, Flatmates, Office Lunch');
    await user.type(nameInput, '   ');

    const button = screen.getByRole('button', { name: 'Create Group' });
    expect(button).toBeDisabled();
  });

  it('should call router.push and router.refresh on form submission', async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ group: { id: 'group-1' } }),
    });

    render(<NewGroupPage />);

    await user.type(screen.getByPlaceholderText('e.g. Goa Trip, Flatmates, Office Lunch'), 'Beach Trip');
    await user.click(screen.getByRole('button', { name: 'Create Group' }));

    expect(mockPush).toHaveBeenCalledWith('/groups');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
