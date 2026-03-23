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

// Mock shared package getInitials
jest.mock('@hisabkitab/shared', () => ({
  getInitials: (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((word: string) => word[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join(''),
}));

import { Avatar } from './avatar';

describe('Avatar', () => {
  it('renders initials for a two-word name', () => {
    render(<Avatar name="John Doe" />);

    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders initials for a single-word name', () => {
    render(<Avatar name="Alice" />);

    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders correct default size (40)', () => {
    const { toJSON } = render(<Avatar name="John Doe" />);

    const tree = toJSON() as any;
    // The root View should have width=40, height=40, borderRadius=20
    expect(tree.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 40,
          height: 40,
          borderRadius: 20,
        }),
      ]),
    );
  });

  it('renders correct custom size', () => {
    const { toJSON } = render(<Avatar name="Jane" size={60} />);

    const tree = toJSON() as any;
    expect(tree.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 60,
          height: 60,
          borderRadius: 30,
        }),
      ]),
    );
  });

  it('handles empty name by falling back to "User"', () => {
    render(<Avatar name="" />);

    // Empty name -> safeName = "User" -> initials = "U"
    expect(screen.getByText('U')).toBeTruthy();
  });

  it('renders initials for a three-word name (takes first two)', () => {
    render(<Avatar name="Ada Lovelace Byron" />);

    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('applies font size proportional to avatar size', () => {
    const { toJSON } = render(<Avatar name="Test" size={80} />);

    const tree = toJSON() as any;
    // The Text child should have fontSize = 80 * 0.4 = 32
    const textNode = tree.children[0];
    expect(textNode.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontSize: 32 }),
      ]),
    );
  });
});
