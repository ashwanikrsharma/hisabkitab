import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, RADIUS, SPACING, FONT_SIZE, SHADOWS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';
import type { SyncConflict } from '../lib/local-db';

type ConflictCardProps = {
  conflict: SyncConflict;
  onAcknowledge: (id: number) => void;
};

const TABLE_NAME_MAP: Record<string, string> = {
  local_expenses: 'Expense',
  local_expense_splits: 'Expense Split',
  local_groups: 'Group',
  local_group_members: 'Group Member',
  local_settlements: 'Settlement',
  local_activity_log: 'Activity',
  local_users: 'User',
  expenses: 'Expense',
  expense_splits: 'Expense Split',
  groups: 'Group',
  group_members: 'Group Member',
  settlements: 'Settlement',
  activity_log: 'Activity',
  users: 'User',
};

function formatTableName(tableName: string): string {
  return TABLE_NAME_MAP[tableName] ?? tableName;
}

function getResolutionLabel(resolution: string): string {
  const lower = resolution.toLowerCase();
  if (lower.includes('server')) return 'Server Won';
  if (lower.includes('local')) return 'Local Won';
  if (lower.includes('merge')) return 'Merged';
  return resolution;
}

function getResolutionColor(resolution: string, colors: ColorTokens): string {
  const lower = resolution.toLowerCase();
  if (lower.includes('server')) return colors.warning;
  if (lower.includes('local')) return colors.success;
  if (lower.includes('merge')) return colors.primary;
  return colors.textSecondary;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatJsonSafe(jsonStr: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2);
  } catch {
    return jsonStr;
  }
}

export function ConflictCard({ conflict, onAcknowledge }: ConflictCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleAcknowledge = useCallback(() => {
    onAcknowledge(conflict.id);
  }, [conflict.id, onAcknowledge]);

  const resolutionLabel = getResolutionLabel(conflict.resolution);
  const resolutionColor = getResolutionColor(conflict.resolution, colors);

  return (
    <View style={styles.card} testID={`conflict-card-${conflict.id}`}>
      {/* Header — tappable to expand */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.7}
        testID={`conflict-toggle-${conflict.id}`}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.tableName}>
            {formatTableName(conflict.table_name)}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(conflict.resolved_at)}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.badge, { backgroundColor: resolutionColor }]}>
            <Text style={styles.badgeText}>{resolutionLabel}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Record ID */}
      <Text style={styles.recordId} numberOfLines={1}>
        Record: {conflict.record_id}
      </Text>

      {/* Expandable diff section */}
      {expanded && (
        <View style={styles.diffSection}>
          <View style={styles.diffBlock}>
            <View style={styles.diffLabelRow}>
              <Ionicons name="phone-portrait-outline" size={14} color={colors.primary} />
              <Text style={styles.diffLabel}>Local Data</Text>
            </View>
            <ScrollView
              horizontal
              style={styles.diffScrollContainer}
              contentContainerStyle={styles.diffScrollContent}
            >
              <Text style={styles.diffText} selectable>
                {formatJsonSafe(conflict.local_data)}
              </Text>
            </ScrollView>
          </View>

          <View style={styles.diffDivider} />

          <View style={styles.diffBlock}>
            <View style={styles.diffLabelRow}>
              <Ionicons name="cloud-outline" size={14} color={colors.success} />
              <Text style={styles.diffLabel}>Server Data</Text>
            </View>
            <ScrollView
              horizontal
              style={styles.diffScrollContainer}
              contentContainerStyle={styles.diffScrollContent}
            >
              <Text style={styles.diffText} selectable>
                {formatJsonSafe(conflict.server_data)}
              </Text>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Acknowledge button */}
      <TouchableOpacity
        style={styles.acknowledgeButton}
        onPress={handleAcknowledge}
        activeOpacity={0.7}
        testID={`conflict-acknowledge-${conflict.id}`}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.acknowledgeText}>Acknowledge</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
    },
    headerLeft: {
      flex: 1,
      gap: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    tableName: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: colors.text,
    },
    timestamp: {
      fontSize: FONT_SIZE.xs,
      color: colors.textMuted,
    },
    recordId: {
      fontSize: FONT_SIZE.xs,
      color: colors.textMuted,
      fontFamily: 'monospace',
    },
    badge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
    },
    badgeText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '700',
      color: '#ffffff',
    },
    diffSection: {
      backgroundColor: colors.bg,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    diffBlock: {
      gap: SPACING.xs,
    },
    diffLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    diffLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    diffScrollContainer: {
      maxHeight: 200,
    },
    diffScrollContent: {
      paddingRight: SPACING.lg,
    },
    diffText: {
      fontSize: FONT_SIZE.xs,
      color: colors.text,
      fontFamily: 'monospace',
      lineHeight: 18,
    },
    diffDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    acknowledgeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      minHeight: 44,
    },
    acknowledgeText: {
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      color: colors.primary,
    },
  });
