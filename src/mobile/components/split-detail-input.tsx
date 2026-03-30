import { useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { SplitType } from '@hisabkitab/shared';
import { useTheme, RADIUS, SPACING } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';
import { Avatar } from './avatar';

type SplitMember = {
  id: string;
  name: string;
};

type SplitDetailInputProps = {
  members: SplitMember[];
  splitType: SplitType;
  totalAmount: number;
  currency: string;
  onChange: (splits: Record<string, string>) => void;
  splits: Record<string, string>;
  error?: string;
  disabled?: boolean;
};

const FORMAT_CURRENCY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
});

function formatAmount(value: number, currency: string): string {
  if (currency === 'INR') {
    return FORMAT_CURRENCY.format(value);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value);
}

export function SplitDetailInput({
  members,
  splitType,
  totalAmount,
  currency,
  onChange,
  splits,
  error,
  disabled,
}: SplitDetailInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSplitChange = useCallback(
    (memberId: string, value: string) => {
      onChange({ ...splits, [memberId]: value });
    },
    [splits, onChange],
  );

  const memberCount = members.length;
  const equalShare = memberCount > 0 ? totalAmount / memberCount : 0;

  // Compute running total for exact/percentage
  const runningTotal = useMemo(() => {
    return members.reduce((sum, m) => {
      const val = parseFloat(splits[m.id] ?? '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [members, splits]);

  const expectedTotal = splitType === 'percentage' ? 100 : totalAmount;
  const totalMatches = Math.abs(runningTotal - expectedTotal) <= 0.01;
  const suffix = splitType === 'percentage' ? '%' : '';
  const expectedLabel =
    splitType === 'percentage'
      ? '100%'
      : formatAmount(totalAmount, currency);

  if (members.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="split-detail-input">
      {members.map((member) => (
        <View key={member.id} style={styles.memberRow}>
          <Avatar name={member.name} size={32} />
          <Text style={styles.memberName} numberOfLines={1}>
            {member.name}
          </Text>

          {splitType === 'equal' ? (
            <Text style={styles.equalAmount} testID={`split-equal-${member.id}`}>
              {formatAmount(equalShare, currency)}
            </Text>
          ) : (
            <TextInput
              style={styles.splitInput}
              value={splits[member.id] ?? ''}
              onChangeText={(val) => handleSplitChange(member.id, val)}
              placeholder={splitType === 'percentage' ? '%' : '0.00'}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              editable={!disabled}
              testID={`split-input-${member.id}`}
            />
          )}
        </View>
      ))}

      {/* Summary row */}
      {splitType !== 'equal' && (
        <View style={styles.summaryRow} testID="split-summary">
          <Text style={styles.summaryLabel}>Total</Text>
          <Text
            style={[
              styles.summaryValue,
              !totalMatches && styles.summaryValueError,
            ]}
          >
            {runningTotal.toFixed(splitType === 'percentage' ? 1 : 2)}
            {suffix} / {expectedLabel}
          </Text>
        </View>
      )}

      {error ? (
        <Text style={styles.errorText} testID="split-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      gap: SPACING.sm,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 48,
    },
    memberName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    equalAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      minWidth: 80,
      textAlign: 'right',
    },
    splitInput: {
      width: 100,
      backgroundColor: colors.bg,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'right',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: SPACING.xs,
    },
    summaryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.success,
    },
    summaryValueError: {
      color: colors.danger,
    },
    errorText: {
      fontSize: 13,
      color: colors.danger,
      fontWeight: '500',
      paddingHorizontal: 4,
      marginTop: SPACING.xs,
    },
  });
