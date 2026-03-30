import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, RADIUS, SPACING, FONT_SIZE, SHADOWS } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import {
  getUnacknowledgedConflicts,
  acknowledgeConflict,
  acknowledgeAllConflicts,
} from '../../../lib/local-db';
import type { SyncConflict } from '../../../lib/local-db';
import { ConflictCard } from '../../../components/conflict-card';

export default function ConflictsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConflicts = useCallback(async () => {
    try {
      const data = await getUnacknowledgedConflicts();
      setConflicts(data);
    } catch (err) {
      console.error('[conflicts] Failed to load conflicts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadConflicts();
    }, [loadConflicts]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadConflicts();
  }, [loadConflicts]);

  const handleAcknowledge = useCallback(async (id: number) => {
    try {
      await acknowledgeConflict(id);
      setConflicts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('[conflicts] Failed to acknowledge conflict:', err);
    }
  }, []);

  const handleAcknowledgeAll = useCallback(async () => {
    try {
      await acknowledgeAllConflicts();
      setConflicts([]);
    } catch (err) {
      console.error('[conflicts] Failed to acknowledge all conflicts:', err);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SyncConflict }) => (
      <ConflictCard conflict={item} onAcknowledge={handleAcknowledge} />
    ),
    [handleAcknowledge],
  );

  const keyExtractor = useCallback((item: SyncConflict) => String(item.id), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          testID="conflicts-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sync Conflicts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conflicts.length === 0 ? (
        /* Empty state */
        <View style={styles.emptyContainer} testID="conflicts-empty-state">
          <Ionicons
            name="checkmark-circle"
            size={64}
            color={colors.success}
          />
          <Text style={styles.emptyTitle}>No conflicts</Text>
          <Text style={styles.emptySubtitle}>
            Everything is in sync
          </Text>
        </View>
      ) : (
        <>
          {/* Acknowledge All button — only when more than 1 conflict */}
          {conflicts.length > 1 && (
            <View style={styles.acknowledgeAllContainer}>
              <TouchableOpacity
                style={styles.acknowledgeAllButton}
                onPress={handleAcknowledgeAll}
                activeOpacity={0.7}
                testID="acknowledge-all-button"
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.acknowledgeAllText}>
                  Acknowledge All ({conflicts.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={conflicts}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            testID="conflicts-list"
          />
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      paddingTop: SPACING.xl,
    },
    backButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: FONT_SIZE.xl,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 44,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    acknowledgeAllContainer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xs,
    },
    acknowledgeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.card,
      minHeight: 44,
      ...SHADOWS.sm,
    },
    acknowledgeAllText: {
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      color: colors.primary,
    },
    listContent: {
      padding: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: 48,
    },
    separator: {
      height: SPACING.md,
    },
  });
