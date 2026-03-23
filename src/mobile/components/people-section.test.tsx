import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock theme
jest.mock('../lib/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      bg: '#fff',
      card: '#ffffff',
      border: '#ccc',
      primary: '#E8651A',
      primaryLight: '#FF8A47',
      success: '#059669',
      danger: '#E11D48',
      warning: '#f6e05e',
      text: '#1a1a1a',
      textSecondary: '#6b6b6b',
      textMuted: '#9ca3af',
      tabInactive: '#999',
    },
    mode: 'light',
    toggle: jest.fn(),
  })),
  RADIUS: { sm: 8, md: 12, lg: 14, xl: 16, pill: 20, full: 9999 },
  SHADOWS: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
  },
}));

import { PeopleSection } from './people-section';
import type { PersonBalance } from '../hooks/use-people-balances';

const mockPeople: PersonBalance[] = [
  {
    userId: 'user-a',
    name: 'Alice Sharma',
    youOwe: 0,
    owesYou: 500,
    net: 500,
    currency: 'INR',
  },
  {
    userId: 'user-b',
    name: 'Bob Kumar',
    youOwe: 300,
    owesYou: 0,
    net: -300,
    currency: 'INR',
  },
];

describe('PeopleSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section title', () => {
    render(<PeopleSection people={mockPeople} isLoading={false} />);

    expect(screen.getByText('People')).toBeTruthy();
  });

  it('renders people with their names', () => {
    render(<PeopleSection people={mockPeople} isLoading={false} />);

    expect(screen.getByText('Alice Sharma')).toBeTruthy();
    expect(screen.getByText('Bob Kumar')).toBeTruthy();
  });

  it('shows "owes you" for positive net balance', () => {
    render(<PeopleSection people={mockPeople} isLoading={false} />);

    expect(screen.getByText('owes you')).toBeTruthy();
  });

  it('shows "you owe" for negative net balance', () => {
    render(<PeopleSection people={mockPeople} isLoading={false} />);

    expect(screen.getByText('you owe')).toBeTruthy();
  });

  it('renders formatted currency amounts', () => {
    render(<PeopleSection people={mockPeople} isLoading={false} />);

    // formatCurrency(500, 'INR') => '₹500.00' and formatCurrency(300, 'INR') => '₹300.00'
    expect(screen.getByText('₹500.00')).toBeTruthy();
    expect(screen.getByText('₹300.00')).toBeTruthy();
  });

  it('renders testID for each person row', () => {
    render(<PeopleSection people={mockPeople} isLoading={false} />);

    expect(screen.getByTestId('person-row-user-a')).toBeTruthy();
    expect(screen.getByTestId('person-row-user-b')).toBeTruthy();
  });

  it('renders empty state when people array is empty', () => {
    render(<PeopleSection people={[]} isLoading={false} />);

    expect(screen.getByText('All settled up!')).toBeTruthy();
  });

  it('does not render person rows in empty state', () => {
    render(<PeopleSection people={[]} isLoading={false} />);

    expect(screen.queryByText('owes you')).toBeNull();
    expect(screen.queryByText('you owe')).toBeNull();
  });

  it('shows loading indicator when isLoading is true', () => {
    render(<PeopleSection people={[]} isLoading={true} />);

    expect(screen.getByText('People')).toBeTruthy();
    // ActivityIndicator should be present — no people rows or empty text
    expect(screen.queryByText('All settled up!')).toBeNull();
    expect(screen.queryByText('owes you')).toBeNull();
  });

  it('renders a single person correctly', () => {
    const singlePerson: PersonBalance[] = [
      {
        userId: 'user-x',
        name: 'Charlie',
        youOwe: 0,
        owesYou: 1000,
        net: 1000,
        currency: 'INR',
      },
    ];
    render(<PeopleSection people={singlePerson} isLoading={false} />);

    expect(screen.getByText('Charlie')).toBeTruthy();
    expect(screen.getByText('₹1,000.00')).toBeTruthy();
    expect(screen.getByText('owes you')).toBeTruthy();
  });
});
