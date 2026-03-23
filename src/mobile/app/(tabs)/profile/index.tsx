import { useState, useEffect, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../store/auth';
import { useUserProfile, useUpdateProfile } from '../../../hooks/use-api';
import { useTheme, RADIUS } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import { Avatar } from '../../../components/avatar';

export default function ProfileScreen() {
  const { colors, mode, toggle } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate(
      {
        name: name.trim() || undefined,
        default_currency: 'INR',
      },
      {
        onSuccess: () => {
          setDirty(false);
          Alert.alert('Saved', 'Profile updated successfully.');
        },
      },
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setDirty(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const displayName = profile?.name ?? session?.user?.email ?? 'User';
  const phone = session?.user?.phone ?? profile?.phone;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Avatar name={displayName} size={80} />
          <Text style={styles.displayName}>{displayName}</Text>
          {phone && <Text style={styles.phone}>{phone}</Text>}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={handleChange(setName)}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Appearance</Text>
            <View style={styles.appearanceRow}>
              <TouchableOpacity
                style={[styles.appearanceOption, mode === 'light' && styles.appearanceOptionSelected]}
                onPress={() => { if (mode !== 'light') toggle(); }}
              >
                <View style={styles.appearanceOptionContent}>
                  <Ionicons name="sunny-outline" size={16} color={mode === 'light' ? '#ffffff' : colors.textSecondary} />
                  <Text style={[styles.appearanceOptionText, mode === 'light' && styles.appearanceOptionTextSelected]}>Light</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.appearanceOption, mode === 'dark' && styles.appearanceOptionSelected]}
                onPress={() => { if (mode !== 'dark') toggle(); }}
              >
                <View style={styles.appearanceOptionContent}>
                  <Ionicons name="moon-outline" size={16} color={mode === 'dark' ? '#ffffff' : colors.textSecondary} />
                  <Text style={[styles.appearanceOptionText, mode === 'dark' && styles.appearanceOptionTextSelected]}>Dark</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Save */}
        {dirty && (
          <TouchableOpacity
            style={[styles.saveButton, updateProfile.isPending && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  phone: {
    fontSize: 14,
    color: colors.textSecondary,
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
  appearanceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  appearanceOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  appearanceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appearanceOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  appearanceOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  appearanceOptionTextSelected: {
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  signOutButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
