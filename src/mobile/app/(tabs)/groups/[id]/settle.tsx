import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useGroupBalances, useCreateSettlement } from '../../../../hooks/use-api';
import { useSettlements } from '../../../../hooks/use-settlements';
import { useUpdateSettlement } from '../../../../hooks/use-update-settlement';
import { useTheme, RADIUS } from '../../../../lib/theme';
import type { ColorTokens } from '../../../../lib/theme';
import { useAuthStore } from '../../../../store/auth';
import { ScreenHeader } from '../../../../components/screen-header';
import { EmptyState } from '../../../../components/empty-state';
import { SettlementStatusBadge } from '../../../../components/settlement-status-badge';
import type { Debt } from '../../../../hooks/use-api';
import type { SettlementItem } from '../../../../hooks/use-settlements';

const formatCurrency = (amount: number, currency: string = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

export default function SettleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const session = useAuthStore((s) => s.session);
  const currentUserId = session?.user?.id;

  const {
    data: debts,
    isLoading: debtsLoading,
    isError: debtsError,
    error: debtsErrorObj,
    refetch: refetchDebts,
    isFetching: debtsFetching,
  } = useGroupBalances(id);

  const {
    data: settlements,
    isLoading: settlementsLoading,
    refetch: refetchSettlements,
    isFetching: settlementsFetching,
  } = useSettlements(id);

  const settleMutation = useCreateSettlement();
  const updateStatusMutation = useUpdateSettlement();

  const isLoading = debtsLoading || settlementsLoading;
  const isFetching = debtsFetching || settlementsFetching;

  const refetchAll = useCallback(() => {
    refetchDebts();
    refetchSettlements();
  }, [refetchDebts, refetchSettlements]);

  const handleMarkPaid = useCallback(
    (debt: Debt) => {
      Alert.alert(
        'Mark as Paid',
        `Mark ${debt.fromName}'s payment of ${formatCurrency(debt.amount, debt.currency)} to ${debt.toName} as settled?`,
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

  const handleSettlementAction = useCallback(
    (settlement: SettlementItem) => {
      if (!currentUserId) return;

      const isParty =
        settlement.payer_id === currentUserId ||
        settlement.payee_id === currentUserId;

      if (!isParty) return;

      Alert.alert(
        'Update Settlement',
        `Change the status of this ${formatCurrency(settlement.amount, settlement.currency)} settlement?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => {
              updateStatusMutation.mutate({
                settlementId: settlement.id,
                status: 'confirmed',
                groupId: id,
              });
            },
          },
          {
            text: 'Dispute',
            style: 'destructive',
            onPress: () => {
              updateStatusMutation.mutate({
                settlementId: settlement.id,
                status: 'disputed',
                groupId: id,
              });
            },
          },
        ],
      );
    },
    [currentUserId, id, updateStatusMutation],
  );

  const renderDebt = ({ item }: { item: Debt }) => (
    <View style={styles.debtCard} testID="debt-card">
      <View style={styles.debtInfo}>
        <Text style={styles.debtText}>
          <Text style={styles.debtName}>{item.fromName}</Text>
          <Text style={styles.debtOwes}> owes </Text>
          <Text style={styles.debtName}>{item.toName}</Text>
        </Text>
        <Text style={styles.debtAmount}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.markPaidButton,
          settleMutation.isPending && styles.buttonDisabled,
        ]}
        onPress={() => handleMarkPaid(item)}
        disabled={settleMutation.isPending}
        testID="mark-paid-button"
      >
        <Text style={styles.markPaidButtonText}>Mark as paid</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSettlement = ({ item }: { item: SettlementItem }) => {
    const isParty =
      currentUserId != null &&
      (item.payer_id === currentUserId || item.payee_id === currentUserId);

    // Build display names -- use "You" for current user
    const payerLabel =
      item.payer_id === currentUserId ? 'You' : item.payer_id.slice(0, 8);
    const payeeLabel =
      item.payee_id === currentUserId ? 'You' : item.payee_id.slice(0, 8);

    const dateStr = new Date(item.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

    return (
      <TouchableOpacity
        style={styles.settlementCard}
        onPress={() => handleSettlementAction(item)}
        disabled={!isParty || updateStatusMutation.isPending}
        activeOpacity={isParty ? 0.7 : 1}
        testID="settlement-card"
      >
        <View style={styles.settlementTop}>
          <View style={styles.settlementInfo}>
            <Text style={styles.settlementNames}>
              <Text style={styles.debtName}>{payerLabel}</Text>
              <Text style={styles.settlementArrow}> paid </Text>
              <Text style={styles.debtName}>{payeeLabel}</Text>
            </Text>
            <View style={styles.settlementMeta}>
              <Text style={styles.settlementDate}>{dateStr}</Text>
              {item.note ? (
                <>
                  <Text style={styles.settlementDot}> &middot; </Text>
                  <Text style={styles.settlementNote} numberOfLines={1}>
                    {item.note}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.settlementRight}>
            <Text style={styles.settlementAmount}>
              {formatCurrency(item.amount, item.currency)}
            </Text>
            <SettlementStatusBadge status={item.status} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const hasDebts = debts != null && debts.length > 0;
  const hasSettlements = settlements != null && settlements.length > 0;
  const isEmpty = !hasDebts && !hasSettlements;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScreenHeader title="Settle Up" />

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : debtsError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>
              {debtsErrorObj instanceof Error
                ? debtsErrorObj.message
                : 'Failed to load balances.'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={refetchAll}
              testID="retry-button"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : isEmpty ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="All settled up!"
            subtitle="No outstanding balances in this group."
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetchAll}
                tintColor={colors.primary}
              />
            }
          >
            {hasDebts && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Outstanding Debts</Text>
                </View>
                {debts.map((debt) => (
                  <View key={`debt-${debt.fromUserId}-${debt.toUserId}-${debt.amount}`}>
                    {renderDebt({ item: debt })}
                  </View>
                ))}
              </View>
            )}

            {hasSettlements && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Settlement History</Text>
                </View>
                {settlements.map((settlement) => (
                  <View key={`settlement-${settlement.id}`}>
                    {renderSettlement({ item: settlement })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
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
    sectionHeader: {
      paddingTop: 12,
      paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
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
      minHeight: 44,
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    markPaidButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    // Settlement history card styles
    settlementCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settlementTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    settlementInfo: {
      flex: 1,
      gap: 4,
    },
    settlementNames: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    settlementArrow: {
      fontWeight: '400',
      color: colors.textSecondary,
    },
    settlementMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settlementDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    settlementDot: {
      fontSize: 12,
      color: colors.textMuted,
    },
    settlementNote: {
      fontSize: 12,
      color: colors.textMuted,
      flexShrink: 1,
    },
    settlementRight: {
      alignItems: 'flex-end',
      gap: 6,
    },
    settlementAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
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
      minHeight: 44,
      justifyContent: 'center',
    },
    retryButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
  });
