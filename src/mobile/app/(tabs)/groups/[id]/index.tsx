import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useGroupDetail, useGroupExpenses, useGroupBalances, useDeleteExpense } from '../../../../hooks/use-api';
import { useAuthStore } from '../../../../store/auth';
import { useTheme, RADIUS } from '../../../../lib/theme';
import type { ColorTokens } from '../../../../lib/theme';
import { ScreenHeader } from '../../../../components/screen-header';
import { Avatar } from '../../../../components/avatar';
import { Card } from '../../../../components/card';
import { EmptyState } from '../../../../components/empty-state';
import { CATEGORY_ICONS, type ExpenseCategory } from '@hisabkitab/shared';
import { formatDate, formatCurrency, type SupportedCurrency } from '@hisabkitab/shared';
import type { ExpenseItem, Debt } from '../../../../hooks/use-api';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: group, isLoading: groupLoading, refetch: refetchGroup } = useGroupDetail(id);
  const { data: expenses, isLoading: expensesLoading, refetch: refetchExpenses } = useGroupExpenses(id);
  const { data: debts, refetch: refetchBalances } = useGroupBalances(id);
  const deleteExpense = useDeleteExpense();

  const refetchAll = () => {
    refetchGroup();
    refetchExpenses();
    refetchBalances();
  };

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteExpense.mutate({ expenseId, groupId: id }),
      },
    ]);
  };

  if (groupLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const currency = (group?.currency ?? 'INR') as SupportedCurrency;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={group?.name ?? ''}
        rightElement={
          <TouchableOpacity onPress={() => router.push(`/(tabs)/groups/${id}/settle`)}>
            <Text style={styles.settleButton}>Settle</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={colors.primary} />
        }
      >
        {/* Members Row */}
        {group?.members && group.members.length > 0 && (
          <View style={styles.membersSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              <TouchableOpacity onPress={() => router.push(`/(tabs)/groups/${id}/add-member`)}>
                <Text style={styles.addLink}>+ Add</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersRow}>
              {group.members.map((m) => (
                <View key={m.id} style={styles.memberItem}>
                  <Avatar name={m.name} size={40} />
                  <Text style={styles.memberName} numberOfLines={1}>{(m.name ?? 'User').split(' ')[0]}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Balances Section */}
        {debts && debts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Outstanding</Text>
            {debts.slice(0, 3).map((debt: Debt) => (
              <Card key={`${debt.fromUserId}-${debt.toUserId}`} style={styles.debtCard}>
                <Text style={styles.debtText}>
                  <Text style={styles.debtName}>{debt.fromName}</Text>
                  {' owes '}
                  <Text style={styles.debtName}>{debt.toName}</Text>
                </Text>
                <Text style={styles.debtAmount}>
                  {formatCurrency(debt.amount, currency)}
                </Text>
              </Card>
            ))}
          </View>
        )}

        {/* Add Expense Button */}
        <TouchableOpacity
          style={styles.addExpenseButton}
          onPress={() =>
            router.push(
              `/(tabs)/groups/${id}/add-expense?currency=${encodeURIComponent(group?.currency ?? 'INR')}`,
            )
          }
        >
          <Text style={styles.addExpenseButtonText}>+ Add Expense</Text>
        </TouchableOpacity>

        {/* Expense List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          {expensesLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
          ) : !expenses || expenses.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No expenses yet"
              subtitle='Tap "+ Add Expense" to get started.'
            />
          ) : (
            expenses.map((item: ExpenseItem) => {
              const catIcon = item.category
                ? CATEGORY_ICONS[item.category as ExpenseCategory] ?? '📦'
                : '📦';
              const canDelete = item.paidById === userId;

              return (
                <Card key={item.id} style={styles.expenseCard}>
                  <View style={styles.expenseRow}>
                    <Text style={styles.expenseEmoji}>{catIcon}</Text>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseDesc} numberOfLines={1}>
                        {item.description}
                      </Text>
                      <Text style={styles.expenseMeta}>
                        Paid by {item.paidByName} · {formatDate(item.created_at)}
                      </Text>
                    </View>
                    <View style={styles.expenseRight}>
                      <Text style={styles.expenseAmount}>
                        {formatCurrency(Number(item.amount), currency)}
                      </Text>
                      {canDelete && (
                        <TouchableOpacity
                          onPress={() => handleDeleteExpense(item.id)}
                          hitSlop={8}
                        >
                          <Text style={styles.deleteIcon}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: 48,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.bg,
    },
    scrollContainer: {
      flex: 1,
    },
    settleButton: {
      color: colors.success,
      fontSize: 15,
      fontWeight: '600',
    },
    membersSection: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    membersRow: {
      gap: 16,
      paddingBottom: 8,
    },
    memberItem: {
      alignItems: 'center',
      gap: 4,
      width: 56,
    },
    memberName: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    addLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    debtCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      padding: 12,
    },
    debtText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    debtName: {
      fontWeight: '700',
      color: colors.text,
    },
    debtAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.warning,
    },
    addExpenseButton: {
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: RADIUS.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    addExpenseButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    expenseCard: {
      marginBottom: 10,
      padding: 14,
    },
    expenseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    expenseEmoji: {
      fontSize: 24,
    },
    expenseInfo: {
      flex: 1,
      gap: 2,
    },
    expenseDesc: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    expenseMeta: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    expenseRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    expenseAmount: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.warning,
    },
    deleteIcon: {
      fontSize: 16,
    },
  });
