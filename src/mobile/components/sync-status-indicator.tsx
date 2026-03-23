/**
 * Small dot indicator showing sync status.
 *
 * - Green: all synced (pendingCount === 0, no errors/conflicts)
 * - Orange/yellow: syncing or pending changes (shows count)
 * - Red: sync error or unacknowledged conflicts
 *
 * Tap to trigger a manual sync.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSyncStatus } from '../hooks/use-sync-status';
import { useTheme } from '../lib/theme';

export function SyncStatusIndicator() {
  const { status, pendingCount, conflictCount, triggerSync } = useSyncStatus();
  const { colors } = useTheme();

  const color =
    status === 'error' || conflictCount > 0
      ? colors.danger
      : pendingCount > 0 || status === 'syncing'
        ? colors.warning
        : colors.success;

  return (
    <TouchableOpacity
      onPress={triggerSync}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${status}. ${pendingCount} pending changes.`}
      data-testid="sync-status-indicator"
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      {pendingCount > 0 && (
        <Text style={[styles.count, { color }]}>{pendingCount}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
