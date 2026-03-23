import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

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

// Mock use-sync-status hook
const mockTriggerSync = jest.fn();
jest.mock('../hooks/use-sync-status', () => ({
  useSyncStatus: jest.fn(() => ({
    status: 'idle' as const,
    pendingCount: 0,
    conflictCount: 0,
    triggerSync: mockTriggerSync,
  })),
}));

import { SyncStatusIndicator } from './sync-status-indicator';
import { useSyncStatus } from '../hooks/use-sync-status';

const mockUseSyncStatus = useSyncStatus as jest.Mock;

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSyncStatus.mockReturnValue({
      status: 'idle',
      pendingCount: 0,
      conflictCount: 0,
      triggerSync: mockTriggerSync,
    });
  });

  it('shows green dot when fully synced (pending=0, no errors)', () => {
    const { toJSON } = render(<SyncStatusIndicator />);

    const tree = toJSON() as any;
    // The dot is the first child of the TouchableOpacity
    const dot = tree.children[0];
    // Green = success color = #059669
    expect(dot.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#059669' }),
      ]),
    );
  });

  it('shows orange/warning dot with count when pending changes exist', () => {
    mockUseSyncStatus.mockReturnValue({
      status: 'idle',
      pendingCount: 3,
      conflictCount: 0,
      triggerSync: mockTriggerSync,
    });

    render(<SyncStatusIndicator />);

    // Should display the count text
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows warning color when status is syncing', () => {
    mockUseSyncStatus.mockReturnValue({
      status: 'syncing',
      pendingCount: 0,
      conflictCount: 0,
      triggerSync: mockTriggerSync,
    });

    const { toJSON } = render(<SyncStatusIndicator />);

    const tree = toJSON() as any;
    const dot = tree.children[0];
    // Warning color = #f6e05e
    expect(dot.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#f6e05e' }),
      ]),
    );
  });

  it('shows red/danger dot on error status', () => {
    mockUseSyncStatus.mockReturnValue({
      status: 'error',
      pendingCount: 0,
      conflictCount: 0,
      triggerSync: mockTriggerSync,
    });

    const { toJSON } = render(<SyncStatusIndicator />);

    const tree = toJSON() as any;
    const dot = tree.children[0];
    // Danger color = #E11D48
    expect(dot.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#E11D48' }),
      ]),
    );
  });

  it('shows red/danger dot when conflicts exist', () => {
    mockUseSyncStatus.mockReturnValue({
      status: 'idle',
      pendingCount: 0,
      conflictCount: 2,
      triggerSync: mockTriggerSync,
    });

    const { toJSON } = render(<SyncStatusIndicator />);

    const tree = toJSON() as any;
    const dot = tree.children[0];
    expect(dot.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#E11D48' }),
      ]),
    );
  });

  it('calls triggerSync on press', () => {
    render(<SyncStatusIndicator />);

    // The component has accessibilityLabel for selection
    const button = screen.getByLabelText(/Sync status/);
    fireEvent.press(button);

    expect(mockTriggerSync).toHaveBeenCalledTimes(1);
  });

  it('does not show count text when pendingCount is 0', () => {
    render(<SyncStatusIndicator />);

    // No number text should be rendered
    expect(screen.queryByText('0')).toBeNull();
  });
});
