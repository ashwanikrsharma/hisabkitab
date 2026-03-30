import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type SettlementStatus = 'pending' | 'confirmed' | 'disputed';

type SettlementStatusBadgeProps = {
  status: SettlementStatus;
};

const STATUS_CONFIG: Record<SettlementStatus, { label: string; bgKey: string; textKey: string }> = {
  pending: { label: 'Pending', bgKey: 'warning', textKey: 'warningText' },
  confirmed: { label: 'Confirmed', bgKey: 'success', textKey: 'successText' },
  disputed: { label: 'Disputed', bgKey: 'danger', textKey: 'dangerText' },
};

export function SettlementStatusBadge({ status }: SettlementStatusBadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const config = STATUS_CONFIG[status];

  const badgeBg =
    status === 'pending'
      ? { backgroundColor: 'rgba(246, 224, 94, 0.2)' }
      : status === 'confirmed'
        ? { backgroundColor: 'rgba(72, 187, 120, 0.2)' }
        : { backgroundColor: 'rgba(252, 129, 129, 0.2)' };

  const badgeTextColor =
    status === 'pending'
      ? colors.warning
      : status === 'confirmed'
        ? colors.success
        : colors.danger;

  return (
    <View
      style={[styles.badge, badgeBg]}
      testID={`settlement-status-badge-${status}`}
    >
      <Text style={[styles.badgeText, { color: badgeTextColor }]}>
        {config.label}
      </Text>
    </View>
  );
}

const createStyles = (_colors: ColorTokens) =>
  StyleSheet.create({
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
