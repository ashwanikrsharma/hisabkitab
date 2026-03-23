import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock sync-engine
const mockGetSyncStatus = jest.fn(() => 'idle' as const);
const mockTriggerSync = jest.fn().mockResolvedValue(undefined);

jest.mock('../lib/sync-engine', () => ({
  getSyncStatus: () => mockGetSyncStatus(),
  triggerSync: () => mockTriggerSync(),
}));

// Mock local-db
const mockGetPendingSyncCount = jest.fn().mockResolvedValue(0);
const mockGetUnacknowledgedConflicts = jest.fn().mockResolvedValue([]);

jest.mock('../lib/local-db', () => ({
  getPendingSyncCount: () => mockGetPendingSyncCount(),
  getUnacknowledgedConflicts: () => mockGetUnacknowledgedConflicts(),
}));

import { useSyncStatus } from './use-sync-status';

describe('useSyncStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetSyncStatus.mockReturnValue('idle');
    mockGetPendingSyncCount.mockResolvedValue(0);
    mockGetUnacknowledgedConflicts.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns idle status initially', async () => {
    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.status).toBe('idle');
  });

  it('returns pending count from local-db', async () => {
    mockGetPendingSyncCount.mockResolvedValue(5);

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(5);
    });
  });

  it('returns conflict count from local-db', async () => {
    mockGetUnacknowledgedConflicts.mockResolvedValue([
      { id: 1, table_name: 'local_expenses', record_id: 'r1' },
      { id: 2, table_name: 'local_groups', record_id: 'r2' },
    ]);

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.conflictCount).toBe(2);
    });
  });

  it('triggerSync calls sync engine and refreshes counts', async () => {
    const { result } = renderHook(() => useSyncStatus());

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(mockTriggerSync).toHaveBeenCalledTimes(1);
    // refresh is called after triggerSync, so getPendingSyncCount is called again
    expect(mockGetPendingSyncCount).toHaveBeenCalled();
  });

  it('returns syncing status when sync engine reports syncing', async () => {
    mockGetSyncStatus.mockReturnValue('syncing');

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.status).toBe('syncing');
    });
  });

  it('handles errors from local-db gracefully', async () => {
    mockGetPendingSyncCount.mockRejectedValue(new Error('DB not initialized'));

    const { result } = renderHook(() => useSyncStatus());

    // Should not throw, counts remain at defaults
    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
  });
});
