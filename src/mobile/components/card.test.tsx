import React from 'react';
import { Text } from 'react-native';
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

import { Card } from './card';

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <Text>Card content</Text>
      </Card>,
    );

    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('renders multiple children', () => {
    render(
      <Card>
        <Text>First</Text>
        <Text>Second</Text>
      </Card>,
    );

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('applies custom styles via the style prop', () => {
    const { toJSON } = render(
      <Card style={{ marginTop: 20 }}>
        <Text>Styled card</Text>
      </Card>,
    );

    const tree = toJSON() as any;
    // Style is an array: [cardStyle, customStyle]
    const flatStyle = tree.props.style;
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marginTop: 20 }),
      ]),
    );
  });

  it('applies card background color from theme', () => {
    const { toJSON } = render(
      <Card>
        <Text>Themed card</Text>
      </Card>,
    );

    const tree = toJSON() as any;
    const flatStyle = tree.props.style;
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#ffffff' }),
      ]),
    );
  });

  it('passes extra ViewProps through', () => {
    const { toJSON } = render(
      <Card testID="my-card">
        <Text>Test</Text>
      </Card>,
    );

    const tree = toJSON() as any;
    expect(tree.props.testID).toBe('my-card');
  });
});
