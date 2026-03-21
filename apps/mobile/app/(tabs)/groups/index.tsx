import { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useGroups } from '../../../hooks/use-api';
import { useTheme } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import type { GroupListItem } from '../../../hooks/use-api';

export default function GroupsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: groups, isLoading, isError, refetch } = useGroups();

  const renderGroup = ({ item }: { item: GroupListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/groups/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text
          style={[
            styles.balance,
            item.yourBalance >= 0 ? styles.balancePositive : styles.balanceNegative,
          ]}
        >
          {item.yourBalance >= 0 ? '+' : ''}
          {item.currency} {Math.abs(item.yourBalance).toFixed(2)}
        </Text>
      </View>
      <Text style={styles.memberCount}>{item.memberCount} members</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/groups/new')}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.errorText}>Failed to load groups. Tap to retry.</Text>
        </TouchableOpacity>
      ) : groups?.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a group to start splitting expenses with friends.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    addButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    addButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    list: {
      padding: 16,
      gap: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    groupName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    balance: {
      fontSize: 16,
      fontWeight: '600',
    },
    balancePositive: {
      color: colors.success,
    },
    balanceNegative: {
      color: colors.danger,
    },
    memberCount: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    loader: {
      marginTop: 80,
    },
    errorText: {
      color: colors.danger,
      textAlign: 'center',
      marginTop: 80,
      fontSize: 15,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
