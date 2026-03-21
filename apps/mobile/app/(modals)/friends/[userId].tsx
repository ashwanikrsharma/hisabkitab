import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { apiClient } from '../../../lib/api-client';
import { useTheme, RADIUS } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import { Avatar } from '../../../components/avatar';
import { Card } from '../../../components/card';
import { ScreenHeader } from '../../../components/screen-header';
import { EmptyState } from '../../../components/empty-state';
import { formatCurrency, formatDate, type SupportedCurrency } from '@hisabkitab/shared';

type FriendDetail = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  netBalance: number;
  currency: string;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    created_at: string;
  }>;
  settlements: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }>;
};

export default function FriendDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [friend, setFriend] = useState<FriendDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<FriendDetail>(`/api/friends/${userId}`)
      .then(setFriend)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!friend) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Friend" />
        <EmptyState icon="🔍" title="Not found" subtitle="Could not load friend details." />
      </SafeAreaView>
    );
  }

  const currency = (friend.currency ?? 'INR') as SupportedCurrency;
  const isPositive = friend.netBalance >= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={friend.name} />

      <FlatList
        data={[
          ...(friend.expenses ?? []).map((e) => ({ ...e, type: 'expense' as const })),
          ...(friend.settlements ?? []).map((s) => ({ ...s, type: 'settlement' as const, description: 'Settlement' })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        ListHeaderComponent={
          <View style={styles.profileSection}>
            <Avatar name={friend.name} size={72} />
            <Text style={styles.friendName}>{friend.name}</Text>
            {friend.phone && <Text style={styles.friendDetail}>{friend.phone}</Text>}
            {friend.email && <Text style={styles.friendDetail}>{friend.email}</Text>}

            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Net Balance</Text>
              <Text style={[styles.balanceAmount, { color: isPositive ? colors.success : colors.danger }]}>
                {isPositive ? '+' : '-'}{formatCurrency(Math.abs(friend.netBalance), currency)}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push(`/(modals)/expenses/new?friendId=${userId}&friendName=${encodeURIComponent(friend.name)}`)}
              >
                <Text style={styles.actionButtonText}>Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.settleActionButton]}
                onPress={() => router.push(`/(modals)/settle?payeeId=${userId}&payeeName=${encodeURIComponent(friend.name)}&amount=${Math.abs(friend.netBalance)}&currency=${currency}`)}
              >
                <Text style={styles.actionButtonText}>Settle Up</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.historyTitle}>History</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.historyCard}>
            <View style={styles.historyRow}>
              <Text style={styles.historyEmoji}>{item.type === 'expense' ? '💸' : '🤝'}</Text>
              <View style={styles.historyInfo}>
                <Text style={styles.historyDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={styles.historyAmount}>
                {formatCurrency(item.amount, (item.currency ?? 'INR') as SupportedCurrency)}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet.</Text>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  profileSection: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
  },
  friendName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  friendDetail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    width: '100%',
    marginTop: 12,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settleActionButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    alignSelf: 'flex-start',
    marginTop: 24,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  historyCard: {
    marginBottom: 8,
    padding: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyEmoji: {
    fontSize: 20,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warning,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
});
