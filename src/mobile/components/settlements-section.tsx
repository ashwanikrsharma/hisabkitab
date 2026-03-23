import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme, RADIUS, SHADOWS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';
import { Card } from './card';
import { formatCurrency, type SupportedCurrency } from '@hisabkitab/shared';
import type { GroupSettlement } from '../hooks/use-people-balances';

type SettlementsSectionProps = {
  groupSettlements: GroupSettlement[];
  userId: string;
};

/**
 * Shows outstanding debts grouped by group, with "Settle" buttons on debts
 * the current user owes.
 */
export function SettlementsSection({ groupSettlements, userId }: SettlementsSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.section} data-testid="settlements-section">
      <Text style={styles.sectionTitle}>Settlements by Group</Text>

      {groupSettlements.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending settlements.</Text>
        </Card>
      ) : (
        groupSettlements.map(({ group, debts, currency }) => (
          <Card key={group.id} style={styles.groupCard}>
            {/* Group header */}
            <TouchableOpacity
              style={styles.groupHeader}
              onPress={() => router.push(`/(tabs)/groups/${group.id}`)}
              activeOpacity={0.7}
              testID={`settlement-group-${group.id}`}
            >
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={styles.chevron}>{'>'}</Text>
            </TouchableOpacity>

            {/* Debt rows */}
            {debts.map((debt, idx) => {
              const iOwe = debt.fromUserId === userId;
              const isLast = idx === debts.length - 1;

              return (
                <View
                  key={`${debt.fromUserId}-${debt.toUserId}-${idx}`}
                  style={[styles.debtRow, !isLast && styles.debtRowBorder]}
                >
                  <View style={styles.debtInfo}>
                    <Text style={styles.debtLabel}>
                      {iOwe ? (
                        <>
                          <Text style={styles.debtLabelMuted}>You owe </Text>
                          <Text style={styles.debtLabelBold}>{debt.toName}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.debtLabelBold}>{debt.fromName}</Text>
                          <Text style={styles.debtLabelMuted}> owes you</Text>
                        </>
                      )}
                    </Text>
                  </View>

                  <View style={styles.debtActions}>
                    <Text
                      style={[
                        styles.debtAmount,
                        { color: iOwe ? colors.danger : colors.success },
                      ]}
                    >
                      {formatCurrency(debt.amount, (currency || 'INR') as SupportedCurrency)}
                    </Text>
                    {iOwe && (
                      <TouchableOpacity
                        style={styles.settleBtn}
                        onPress={() =>
                          router.push(`/(tabs)/groups/${group.id}/settle`)
                        }
                        activeOpacity={0.7}
                        testID={`settle-btn-${group.id}-${debt.toUserId}`}
                        data-testid={`settle-btn-${group.id}-${debt.toUserId}`}
                      >
                        <Text style={styles.settleBtnText}>Settle</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        ))
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    groupCard: {
      padding: 0,
      overflow: 'hidden',
      marginBottom: 12,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.bg,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
    },
    groupName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    chevron: {
      fontSize: 14,
      color: colors.textMuted,
    },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 52,
    },
    debtRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    debtInfo: {
      flex: 1,
      marginRight: 8,
    },
    debtLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    debtLabelBold: {
      fontWeight: '600',
      color: colors.text,
    },
    debtLabelMuted: {
      color: colors.textSecondary,
    },
    debtActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    debtAmount: {
      fontSize: 14,
      fontWeight: '700',
    },
    settleBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      minWidth: 56,
      alignItems: 'center',
    },
    settleBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },
  });
