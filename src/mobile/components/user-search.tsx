import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useUserSearch, type UserSearchResult } from '../hooks/use-api';
import { Avatar } from './avatar';
import { useTheme, RADIUS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type UserSearchProps = {
  onSelect: (user: UserSearchResult) => void;
  excludeIds?: string[];
  placeholder?: string;
};

export function UserSearch({ onSelect, excludeIds = [], placeholder = 'Search by name, email, or phone...' }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useUserSearch(query);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const filtered = (results ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {isLoading && query.length >= 2 ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : filtered.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => {
                onSelect(item);
                setQuery('');
              }}
            >
              <Avatar name={item.name} size={36} />
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultDetail}>
                  {item.email ?? item.phone ?? ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
        />
      ) : query.length >= 2 ? (
        <Text style={styles.noResults}>No users found</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
    },
    loader: {
      marginTop: 12,
    },
    resultsList: {
      maxHeight: 200,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultInfo: {
      flex: 1,
      gap: 2,
    },
    resultName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    resultDetail: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    noResults: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
      fontSize: 14,
    },
  });
