import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: any[]) => mockPush(...args) },
}));

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

import { SettlementsSection } from './settlements-section';
import { fireEvent } from '@testing-library/react-native';
import type { GroupSettlement } from '../hooks/use-people-balances';

const CURRENT_USER_ID = 'me-123';

const mockGroupSettlements: GroupSettlement[] = [
  {
    group: {
      id: 'group-1',
      name: 'Trip to Goa',
    } as any,
    debts: [
      {
        fromUserId: CURRENT_USER_ID,
        fromName: 'Me',
        toUserId: 'user-a',
        toName: 'Alice',
        amount: 750,
      },
      {
        fromUserId: 'user-b',
        fromName: 'Bob',
        toUserId: CURRENT_USER_ID,
        toName: 'Me',
        amount: 200,
      },
    ],
    currency: 'INR',
  },
  {
    group: {
      id: 'group-2',
      name: 'Flat Expenses',
    } as any,
    debts: [
      {
        fromUserId: CURRENT_USER_ID,
        fromName: 'Me',
        toUserId: 'user-c',
        toName: 'Charlie',
        amount: 1500,
      },
    ],
    currency: 'INR',
  },
];

describe('SettlementsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section title', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    expect(screen.getByText('Settlements by Group')).toBeTruthy();
  });

  it('renders group names', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    expect(screen.getByText('Trip to Goa')).toBeTruthy();
    expect(screen.getByText('Flat Expenses')).toBeTruthy();
  });

  it('shows "You owe" for debts where current user is the payer', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    // Current user owes Alice and Charlie
    expect(screen.getAllByText('You owe ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });

  it('shows "owes you" for debts where current user is owed', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText(' owes you')).toBeTruthy();
  });

  it('renders formatted amounts', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    expect(screen.getByText('₹750.00')).toBeTruthy();
    expect(screen.getByText('₹200.00')).toBeTruthy();
    expect(screen.getByText('₹1,500.00')).toBeTruthy();
  });

  it('shows Settle button only for debts the current user owes', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    // Current user owes in group-1 (to Alice) and group-2 (to Charlie) => 2 Settle buttons
    const settleButtons = screen.getAllByText('Settle');
    expect(settleButtons).toHaveLength(2);
  });

  it('does not show Settle button for debts owed to current user', () => {
    // Bob owes current user — no Settle button for that row
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    // The settle button for Bob's debt should not exist
    expect(screen.queryByTestId(`settle-btn-group-1-${CURRENT_USER_ID}`)).toBeNull();
  });

  it('navigates to group detail when group header is pressed', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    fireEvent.press(screen.getByTestId('settlement-group-group-1'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/groups/group-1');
  });

  it('navigates to settle page when Settle button is pressed', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    // Press the settle button for group-1/Alice
    fireEvent.press(screen.getByTestId(`settle-btn-group-1-user-a`));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/groups/group-1/settle');
  });

  it('renders empty state when no settlements', () => {
    render(
      <SettlementsSection groupSettlements={[]} userId={CURRENT_USER_ID} />,
    );

    expect(screen.getByText('No pending settlements.')).toBeTruthy();
  });

  it('does not render group cards in empty state', () => {
    render(
      <SettlementsSection groupSettlements={[]} userId={CURRENT_USER_ID} />,
    );

    expect(screen.queryByText('Trip to Goa')).toBeNull();
    expect(screen.queryByText('Settle')).toBeNull();
  });

  it('renders chevron indicator on group headers', () => {
    render(
      <SettlementsSection
        groupSettlements={mockGroupSettlements}
        userId={CURRENT_USER_ID}
      />,
    );

    // Each group header has a '>' chevron
    const chevrons = screen.getAllByText('>');
    expect(chevrons).toHaveLength(2);
  });
});
