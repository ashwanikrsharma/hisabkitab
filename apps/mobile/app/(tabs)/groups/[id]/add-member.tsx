import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useGroupDetail, useAddMember } from '../../../../hooks/use-api';
import { useTheme } from '../../../../lib/theme';
import type { ColorTokens } from '../../../../lib/theme';
import { ScreenHeader } from '../../../../components/screen-header';
import { UserSearch } from '../../../../components/user-search';
import { Avatar } from '../../../../components/avatar';
import type { UserSearchResult } from '../../../../hooks/use-api';

export default function AddMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: group } = useGroupDetail(id);
  const addMember = useAddMember();
  const [added, setAdded] = useState<UserSearchResult[]>([]);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const existingIds = [
    ...(group?.members?.map((m) => m.id) ?? []),
    ...added.map((a) => a.id),
  ];

  const handleSelect = (user: UserSearchResult) => {
    addMember.mutate(
      { groupId: id, userId: user.id },
      {
        onSuccess: () => {
          setAdded((prev) => [...prev, user]);
          Alert.alert('Added', `${user.name} has been added to the group.`);
        },
      },
    );
  };

  const goBack = () => router.push(`/(tabs)/groups/${id}`);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Add Member" onBack={goBack} />
      <View style={styles.content}>
        <UserSearch
          onSelect={handleSelect}
          excludeIds={existingIds}
          placeholder="Search for people to add..."
        />

        {added.length > 0 && (
          <View style={styles.addedSection}>
            <Text style={styles.addedTitle}>Recently Added</Text>
            {added.map((u) => (
              <View key={u.id} style={styles.addedRow}>
                <Avatar name={u.name} size={32} />
                <Text style={styles.addedName}>{u.name}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.doneButton} onPress={goBack}>
          <Text style={styles.doneButtonText}>Done adding members</Text>
        </TouchableOpacity>
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
    content: {
      flex: 1,
      padding: 20,
      gap: 24,
    },
    addedSection: {
      gap: 12,
    },
    addedTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    addedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    addedName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    doneButton: {
      marginTop: 'auto' as const,
      paddingVertical: 14,
      alignItems: 'center' as const,
    },
    doneButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
  });
