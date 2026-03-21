import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useGroupBalances, useCreateSettlement } from '../../../../hooks/use-api';
import { useTheme, RADIUS } from '../../../../lib/theme';
import type { ColorTokens } from '../../../../lib/theme';
import { ScreenHeader } from '../../../../components/screen-header';
import { EmptyState } from '../../../../components/empty-state';
import type { Debt } from '../../../../hooks/use-api';

export default function SettleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: debts,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGroupBalances(id);

  const settleMutation = useCreateSettlement();

  const handleMarkPaid = useCallback(
    (debt: Debt) => {
      Alert.alert(
        'Mark as Paid',
        `Mark ${debt.fromName}'s payment of ${debt.currency} ${debt.amount.toFixed(2)} to ${debt.toName} as settled?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => {
              settleMutation.mutate({
                groupId: id,
                payerId: debt.fromUserId,
                payeeId: debt.toUserId,
                amount: debt.amount,
                currency: debt.currency,
                note: 'Settled via app',
              });
            },
          },
        ],
      );
    },
    [id, settleMutation],
  );

  const renderDebt = ({ item }: { item: Debt }) => (
    <View style={styles.debtCard}>
      <View style={styles.debtInfo}>
        <Text style={styles.debtText}>
          <Text style={styles.debtName}>{item.fromName}</Text>
          <Text style={styles.debtOwes}> owes </Text>
          <Text style={styles.debtName}>{item.toName}</Text>
        </Text>
        <Text style={styles.debtAmount}>
          {item.currency} {item.amount.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.markPaidButton,
          settleMutation.isPending && styles.markPaidButtonDisabled,
        ]}
        onPress={() => handleMarkPaid(item)}
        disabled={settleMutation.isPending}
      >
        <Text style={styles.markPaidButtonText}>Mark as paid</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScreenHeader title="Settle Up" />

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load balances.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={debts ?? []}
            keyExtractor={(item) =>
              `${item.fromUserId}-${item.toUserId}-${item.amount}`
            }
            renderItem={renderDebt}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="🎉"
                title="All settled up!"
                subtitle="No outstanding balances in this group."
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    list: {
      padding: 16,
      paddingBottom: 32,
    },
    debtCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    debtInfo: {
      gap: 4,
    },
    debtText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    debtName: {
      fontWeight: '700',
      color: colors.text,
    },
    debtOwes: {
      fontWeight: '400',
      color: colors.textSecondary,
    },
    debtAmount: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.warning,
    },
    markPaidButton: {
      backgroundColor: colors.success,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    markPaidButtonDisabled: {
      opacity: 0.5,
    },
    markPaidButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 16,
    },
    errorText: {
      color: colors.danger,
      textAlign: 'center',
      fontSize: 15,
      lineHeight: 22,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 10,
    },
    retryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
  });
