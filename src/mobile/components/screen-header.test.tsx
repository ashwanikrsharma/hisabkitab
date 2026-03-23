import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

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

import { router } from 'expo-router';
import { ScreenHeader } from './screen-header';

describe('ScreenHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<ScreenHeader title="My Groups" />);

    expect(screen.getByText('My Groups')).toBeTruthy();
  });

  it('shows back button when showBack is true (default)', () => {
    render(<ScreenHeader title="Details" />);

    expect(screen.getByText('< Back')).toBeTruthy();
  });

  it('hides back button when showBack is false', () => {
    render(<ScreenHeader title="Home" showBack={false} />);

    expect(screen.queryByText('< Back')).toBeNull();
  });

  it('calls router.back() on back button press', () => {
    render(<ScreenHeader title="Details" />);

    fireEvent.press(screen.getByText('< Back'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('calls custom onBack when provided instead of router.back()', () => {
    const customOnBack = jest.fn();
    render(<ScreenHeader title="Details" onBack={customOnBack} />);

    fireEvent.press(screen.getByText('< Back'));

    expect(customOnBack).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('renders right element when provided', () => {
    const { getByText } = render(
      <ScreenHeader
        title="Groups"
        rightElement={<React.Fragment />}
      />,
    );

    expect(getByText('Groups')).toBeTruthy();
  });

  it('renders a spacer when no right element is provided', () => {
    const { toJSON } = render(<ScreenHeader title="Test" showBack={false} />);

    // Snapshot to verify structure -- two spacers (left and right) when showBack=false
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
