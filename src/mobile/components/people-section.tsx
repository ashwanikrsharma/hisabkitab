import { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, RADIUS, SHADOWS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';
import { Avatar } from './avatar';
import { Card } from './card';
import { formatCurrency, type SupportedCurrency } from '@hisabkitab/shared';
import type { PersonBalance } from '../hooks/use-people-balances';

type PeopleSectionProps = {
  people: PersonBalance[];
  isLoading: boolean;
};

/**
 * Displays per-person net balances aggregated across all groups.
 * Green = they owe you, red = you owe them.
 */
export function PeopleSection({ people, isLoading }: PeopleSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>People</Text>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.section} data-testid="people-section">
      <Text style={styles.sectionTitle}>People</Text>

      {people.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>All settled up!</Text>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {people.map((person, idx) => {
            const isLast = idx === people.length - 1;
            const netPositive = person.net > 0;
            const netColor = netPositive ? colors.success : colors.danger;
            const netLabel = netPositive ? 'owes you' : 'you owe';
            const netAmount = Math.abs(person.net);

            return (
              <View
                key={person.userId}
                style={[styles.row, !isLast && styles.rowBorder]}
                testID={`person-row-${person.userId}`}
              >
                <Avatar name={person.name} size={36} />
                <View style={styles.nameCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {person.name}
                  </Text>
                  <Text style={styles.subtitle}>{netLabel}</Text>
                </View>
                <Text style={[styles.amount, { color: netColor }]}>
                  {formatCurrency(netAmount, (person.currency || 'INR') as SupportedCurrency)}
                </Text>
              </View>
            );
          })}
        </Card>
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
    loader: {
      marginTop: 16,
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
    listCard: {
      padding: 0,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      minHeight: 56,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    nameCol: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    amount: {
      fontSize: 14,
      fontWeight: '700',
    },
  });
