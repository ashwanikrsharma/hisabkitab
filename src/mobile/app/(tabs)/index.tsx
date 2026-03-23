import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroups, useActivity } from '../../hooks/use-api';
import { usePeopleBalances } from '../../hooks/use-people-balances';
import { useAuthStore } from '../../store/auth';
import { useTheme, RADIUS, SHADOWS } from '../../lib/theme';
import type { ColorTokens } from '../../lib/theme';
import { Card } from '../../components/card';
import { Avatar } from '../../components/avatar';
import { Fab } from '../../components/fab';
import { PeopleSection } from '../../components/people-section';
import { SettlementsSection } from '../../components/settlements-section';
import { GroupPickerModal } from '../../components/group-picker-modal';
import { formatRelativeTime, formatCurrency, type SupportedCurrency } from '@hisabkitab/shared';

const ACTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  expense_added: 'cash-outline',
  expense_deleted: 'trash-outline',
  settlement_created: 'swap-horizontal-outline',
  member_joined: 'person-add-outline',
  group_created: 'people-outline',
  group_renamed: 'pencil-outline',
  group_archived: 'archive-outline',
};

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id ?? '';

  const { data: groups, isLoading: groupsLoading, refetch: refetchGroups } = useGroups();
  const { data: activities, isLoading: activitiesLoading, refetch: refetchActivity } = useActivity();
  const {
    people,
    groupSettlements,
    isLoading: balancesLoading,
    refetch: refetchBalances,
  } = usePeopleBalances();

  const [pickerVisible, setPickerVisible] = useState(false);

  const refetchAll = useCallback(() => {
    refetchGroups();
    refetchActivity();
    refetchBalances();
  }, [refetchGroups, refetchActivity, refetchBalances]);

  // Compute aggregate balances from groups
  const totalOwed = (groups ?? []).reduce(
    (sum, g) => sum + (g.yourBalance > 0 ? g.yourBalance : 0),
    0,
  );
  const totalOwe = (groups ?? []).reduce(
    (sum, g) => sum + (g.yourBalance < 0 ? Math.abs(g.yourBalance) : 0),
    0,
  );

  const recentActivities = (activities ?? []).slice(0, 10);
  const isLoading = groupsLoading || activitiesLoading;

  // FAB actions: "Add Expense" (direct/friend) and "Group Expense" (within a group)
  const handleAddExpense = useCallback(() => {
    // Direct expense — navigate to standalone expense form (modal)
    router.push('/(modals)/expenses/new' as any);
  }, []);

  const handleGroupExpense = useCallback(() => {
    const groupList = groups ?? [];
    if (groupList.length === 0) {
      router.push('/(tabs)/groups/new');
    } else if (groupList.length === 1) {
      router.push(`/(tabs)/groups/${groupList[0]!.id}/add-expense`);
    } else {
      setPickerVisible(true);
    }
  }, [groups]);

  const fabActions = useMemo(() => [
    {
      label: 'Add Expense',
      subtitle: 'Split with friends',
      icon: 'receipt-outline' as const,
      onPress: handleAddExpense,
    },
    {
      label: 'Group Expense',
      subtitle: 'Within a group',
      icon: 'people-outline' as const,
      onPress: handleGroupExpense,
    },
  ], [handleAddExpense, handleGroupExpense]);

  const handleGroupPick = useCallback((groupId: string) => {
    setPickerVisible(false);
    router.push(`/(tabs)/groups/${groupId}/add-expense`);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>HisabKitab</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>You are owed</Text>
                <Text style={[styles.summaryAmount, { color: colors.success }]}>
                  {formatCurrency(totalOwed, 'INR')}
                </Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>You owe</Text>
                <Text style={[styles.summaryAmount, { color: colors.danger }]}>
                  {formatCurrency(totalOwe, 'INR')}
                </Text>
              </Card>
            </View>

            {/* Groups Quick Access */}
            {groups && groups.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Your Groups</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
                    <Text style={styles.seeAll}>See all</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsRow}>
                  {groups.slice(0, 6).map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.groupChip}
                      onPress={() => router.push(`/(tabs)/groups/${g.id}`)}
                      activeOpacity={0.7}
                    >
                      <Avatar name={g.name} size={36} />
                      <Text style={styles.groupChipName} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text
                        style={[
                          styles.groupChipBalance,
                          { color: g.yourBalance >= 0 ? colors.success : colors.danger },
                        ]}
                      >
                        {g.yourBalance >= 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(g.yourBalance), g.currency as SupportedCurrency)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* People */}
            <PeopleSection people={people} isLoading={balancesLoading} />

            {/* Settlements by Group */}
            <SettlementsSection groupSettlements={groupSettlements} userId={userId} />

            {/* Recent Activity */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              {recentActivities.length === 0 ? (
                <Text style={styles.emptyText}>No recent activity yet.</Text>
              ) : (
                recentActivities.map((item) => (
                  <TouchableOpacity
                    key={item.id}
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
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <Fab actions={fabActions} testID="fab-add-expense" />

      {/* Group Picker Modal */}
      <GroupPickerModal
        visible={pickerVisible}
        groups={groups ?? []}
        onSelect={handleGroupPick}
        onClose={() => setPickerVisible(false)}
      />
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  loader: {
    marginTop: 80,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    ...SHADOWS.md,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  groupsRow: {
    gap: 12,
    paddingBottom: 4,
  },
  groupChip: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    width: 100,
    ...SHADOWS.sm,
  },
  groupChipName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  groupChipBalance: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 24,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  activityMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
});
