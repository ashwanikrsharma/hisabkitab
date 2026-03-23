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

import NewDirectExpensePage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('New Direct Expense Page', () => {
  it('should render description input', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByTestId('description-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Coffee, Lunch, Cab ride')).toBeInTheDocument();
  });

  it('should render amount input', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByTestId('amount-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
  });

  it('should render friend search input and search button', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByTestId('friend-search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name or phone...')).toBeInTheDocument();
    expect(screen.getByTestId('friend-search-button')).toBeInTheDocument();
  });

  it('should render Add Expense submit button', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByTestId('submit-expense')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Expense' })).toBeInTheDocument();
  });

  it('should disable Add Expense button when description and friends are empty', () => {
    render(<NewDirectExpensePage />);
    const button = screen.getByTestId('submit-expense');
    expect(button).toBeDisabled();
  });

  it('should render "Paid by" section with You button selected by default', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByTestId('paid-by-selector')).toBeInTheDocument();
    // "You" button for paid-by is present
    const youButton = screen.getAllByRole('button', { name: 'You' })[0];
    expect(youButton).toBeInTheDocument();
  });

  it('should render split type buttons (Equal, Custom, Percentage)', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByRole('button', { name: 'Equal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Percentage' })).toBeInTheDocument();
  });

  it('should render category selector', () => {
    render(<NewDirectExpensePage />);
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
  });

  it('should render Cancel link pointing to dashboard', () => {
    render(<NewDirectExpensePage />);
    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('should disable search button when search input has fewer than 2 characters', async () => {
    const user = userEvent.setup();
    render(<NewDirectExpensePage />);

    const searchInput = screen.getByTestId('friend-search-input');
    await user.type(searchInput, 'A');

    expect(screen.getByTestId('friend-search-button')).toBeDisabled();
  });

  it('should enable search button when search input has 2 or more characters', async () => {
    const user = userEvent.setup();
    render(<NewDirectExpensePage />);

    const searchInput = screen.getByTestId('friend-search-input');
    await user.type(searchInput, 'Al');

    expect(screen.getByTestId('friend-search-button')).toBeEnabled();
  });
});
