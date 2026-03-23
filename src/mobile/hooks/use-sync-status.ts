/**
 * Hook that exposes sync engine status to UI components.
 *
 * Polls every 5 seconds for pending count and conflict count,
 * and provides a manual triggerSync callback.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSyncStatus, triggerSync } from '../lib/sync-engine';
import { getPendingSyncCount, getUnacknowledgedConflicts } from '../lib/local-db';
import type { SyncStatus } from '../lib/sync-engine';

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setStatus(getSyncStatus());
      setPendingCount(await getPendingSyncCount());
      const conflicts = await getUnacknowledgedConflicts();
      setConflictCount(conflicts.length);
    } catch {
      // DB may not be initialized yet -- silently ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const sync = useCallback(async () => {
    await triggerSync();
    await refresh();
  }, [refresh]);

  return { status, pendingCount, conflictCount, triggerSync: sync };
}
