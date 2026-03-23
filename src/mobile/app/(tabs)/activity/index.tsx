import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useActivity } from '../../../hooks/use-api';
import { useTheme } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import { EmptyState } from '../../../components/empty-state';
import { formatRelativeTime } from '@hisabkitab/shared';
import type { ActivityItem } from '../../../hooks/use-api';

const ACTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  expense_added: 'cash-outline',
  expense_deleted: 'trash-outline',
  settlement_created: 'swap-horizontal-outline',
  member_joined: 'person-add-outline',
  group_created: 'people-outline',
  group_renamed: 'pencil-outline',
  group_archived: 'archive-outline',
};

function getDateSection(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Today';
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityScreen() {
  const { data: activities, isLoading, refetch, isFetching } = useActivity();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sections = useMemo(() => {
    if (!activities || activities.length === 0) return [];

    const grouped = new Map<string, ActivityItem[]>();
    for (const item of activities) {
      const section = getDateSection(item.created_at);
      const existing = grouped.get(section) ?? [];
      existing.push(item);
      grouped.set(section, existing);
    }

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [activities]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.activityRow}
              onPress={() => {
                if (item.group_id) {
                  router.push(`/(tabs)/groups/${item.group_id}`);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ACTION_ICONS[item.type] ?? 'ellipse-outline'}
                size={24}
                color={colors.textSecondary}
              />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {item.title ?? (item.type ?? '').replace(/_/g, ' ')}
                </Text>
                <Text style={styles.activityMeta}>
                  {item.group_name ? `${item.group_name} \u00B7 ` : ''}
                  {formatRelativeTime(item.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No activity yet"
              subtitle="Your expense and settlement activity will appear here."
            />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  loader: {
    marginTop: 80,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  activityMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
