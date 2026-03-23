import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

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
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
  },
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, ...props }: any) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

import { Fab } from './fab';

const mockActions = [
  {
    label: 'Add Expense',
    subtitle: 'Split a bill',
    icon: 'receipt-outline' as const,
    onPress: jest.fn(),
  },
  {
    label: 'Settle Up',
    subtitle: 'Record a payment',
    icon: 'swap-horizontal-outline' as const,
    onPress: jest.fn(),
  },
];

describe('Fab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the "+" icon in collapsed state', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    expect(screen.getByText('+')).toBeTruthy();
  });

  it('does not show action items when collapsed', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    expect(screen.queryByText('Add Expense')).toBeNull();
    expect(screen.queryByText('Settle Up')).toBeNull();
  });

  it('shows action items when FAB is pressed', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    fireEvent.press(screen.getByText('+'));

    expect(screen.getByText('Add Expense')).toBeTruthy();
    expect(screen.getByText('Split a bill')).toBeTruthy();
    expect(screen.getByText('Settle Up')).toBeTruthy();
    expect(screen.getByText('Record a payment')).toBeTruthy();
  });

  it('shows "x" icon when expanded', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    fireEvent.press(screen.getByText('+'));

    // The FAB should now show the close icon
    expect(screen.getByText('\u00d7')).toBeTruthy();
    expect(screen.queryByText('+')).toBeNull();
  });

  it('calls action onPress and collapses when action is tapped', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    // Expand
    fireEvent.press(screen.getByText('+'));

    // Tap first action
    fireEvent.press(screen.getByText('Add Expense'));

    expect(mockActions[0].onPress).toHaveBeenCalledTimes(1);
    // Should collapse after action
    expect(screen.queryByText('Add Expense')).toBeNull();
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('calls the correct action when second action is tapped', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    fireEvent.press(screen.getByText('+'));
    fireEvent.press(screen.getByText('Settle Up'));

    expect(mockActions[1].onPress).toHaveBeenCalledTimes(1);
    expect(mockActions[0].onPress).not.toHaveBeenCalled();
  });

  it('closes when backdrop is pressed', () => {
    const { UNSAFE_root } = render(
      <Fab actions={mockActions} testID="fab-btn" />,
    );

    // Expand
    fireEvent.press(screen.getByText('+'));
    expect(screen.getByText('Add Expense')).toBeTruthy();

    // Find and press the backdrop (Pressable with absoluteFill style)
    // The backdrop is the first element rendered when expanded
    const backdrop = UNSAFE_root.findAll(
      (node) =>
        node.props.style &&
        JSON.stringify(node.props.style).includes('rgba(0,0,0,0.4)'),
    )[0];

    expect(backdrop).toBeTruthy();
    fireEvent.press(backdrop!);

    // Should be collapsed now
    expect(screen.queryByText('Add Expense')).toBeNull();
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('toggles back to collapsed when FAB button is pressed again', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    // Expand
    fireEvent.press(screen.getByText('+'));
    expect(screen.getByText('Add Expense')).toBeTruthy();

    // Press the close button
    fireEvent.press(screen.getByText('\u00d7'));

    // Should be collapsed
    expect(screen.queryByText('Add Expense')).toBeNull();
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('renders action icons as Ionicons', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    fireEvent.press(screen.getByText('+'));

    expect(screen.getByTestId('icon-receipt-outline')).toBeTruthy();
    expect(screen.getByTestId('icon-swap-horizontal-outline')).toBeTruthy();
  });

  it('sets correct accessibility label based on state', () => {
    render(<Fab actions={mockActions} testID="fab-btn" />);

    const fab = screen.getByTestId('fab-btn');
    expect(fab.props.accessibilityLabel).toBe('Add expense');

    fireEvent.press(fab);

    const expandedFab = screen.getByTestId('fab-btn');
    expect(expandedFab.props.accessibilityLabel).toBe('Close menu');
  });
});
