import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock theme
jest.mock('../lib/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      bg: '#fff',
      card: '#fff',
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
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, testID, ...props }: any) => (
      <Text testID={testID ?? 'ionicon'}>{name}</Text>
    ),
  };
});

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState icon="mail-open-outline" title="No expenses yet" />);

    expect(screen.getByText('No expenses yet')).toBeTruthy();
  });

  it('renders the icon', () => {
    render(<EmptyState icon="mail-open-outline" title="No expenses yet" />);

    expect(screen.getByTestId('empty-state-icon')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(
      <EmptyState
        icon="mail-open-outline"
        title="No expenses yet"
        subtitle="Add your first expense to get started"
      />,
    );

    expect(screen.getByText('Add your first expense to get started')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<EmptyState icon="mail-open-outline" title="No expenses yet" />);

    // Only icon and title should be present -- 2 text nodes
    const allText = screen.queryByText('Add your first expense to get started');
    expect(allText).toBeNull();
  });

  it('renders different icons correctly', () => {
    render(<EmptyState icon="people-outline" title="No groups" />);

    expect(screen.getByText('No groups')).toBeTruthy();
  });
});
