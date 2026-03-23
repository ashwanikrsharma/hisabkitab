import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useCreateGroup } from '../../../hooks/use-api';
import { useTheme, RADIUS } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import { ScreenHeader } from '../../../components/screen-header';

export default function NewGroupScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const createGroup = useCreateGroup();

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Validation Error', 'Group name is required.');
      return;
    }

    createGroup.mutate(
      { name: trimmedName, currency: 'INR' },
      {
        onSuccess: () => {
          router.back();
        },
      },
    );
  };

  const submitting = createGroup.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="New Group" />

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Goa Trip 2025"
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              autoFocus
              editable={!submitting}
            />
          </View>

        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    content: {
      padding: 20,
      paddingBottom: 48,
    },
    form: {
      gap: 24,
    },
    fieldGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.lg,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 40,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });
