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
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SUPPORTED_CURRENCIES, type SplitType, type ExpenseCategory, CURRENCY_SYMBOLS, type SupportedCurrency } from '@hisabkitab/shared';
import { useAuthStore } from '../../../store/auth';
import { useCreateExpense } from '../../../hooks/use-api';
import { useTheme, RADIUS } from '../../../lib/theme';
import type { ColorTokens } from '../../../lib/theme';
import { ScreenHeader } from '../../../components/screen-header';
import { CategoryPicker } from '../../../components/category-picker';
import { SplitTypePicker } from '../../../components/split-type-picker';
import { UserSearch } from '../../../components/user-search';
import { Avatar } from '../../../components/avatar';
import type { UserSearchResult } from '../../../hooks/use-api';

export default function NewDirectExpenseScreen() {
  const { friendId, friendName } = useLocalSearchParams<{
    friendId?: string;
    friendName?: string;
  }>();

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('INR');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [notes, setNotes] = useState('');
  const [includeSelf, setIncludeSelf] = useState(true);

  // Friends involved
  const [friends, setFriends] = useState<UserSearchResult[]>(
    friendId && friendName
      ? [{ id: friendId, name: friendName }]
      : [],
  );

  const createExpense = useCreateExpense();
  const submitting = createExpense.isPending;

  const handleAddFriend = (user: UserSearchResult) => {
    if (!friends.find((f) => f.id === user.id)) {
      setFriends((prev) => [...prev, user]);
    }
  };

  const handleRemoveFriend = (id: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Description is required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }
    if (friends.length === 0) {
      Alert.alert('Validation Error', 'Add at least one friend.');
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    createExpense.mutate(
      {
        description: description.trim(),
        amount: parsedAmount,
        currency,
        paidById: userId,
        splitType,
        category,
        createdBy: userId,
        splitWith: friends.map((f) => f.id),
        includeSelf,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => router.back(),
      },
    );
  };

  const excludeIds = [userId ?? '', ...friends.map((f) => f.id)].filter(Boolean);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader title="New Expense" />

          <View style={styles.form}>
            {/* Friends */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Split With</Text>
              {friends.length > 0 && (
                <View style={styles.friendChips}>
                  {friends.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.friendChip}
                      onPress={() => handleRemoveFriend(f.id)}
                    >
                      <Avatar name={f.name} size={24} />
                      <Text style={styles.friendChipName}>{f.name}</Text>
                      <Text style={styles.friendChipRemove}>x</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <UserSearch
                onSelect={handleAddFriend}
                excludeIds={excludeIds}
                placeholder="Add friends..."
              />
            </View>

            {/* Include self */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include yourself in split</Text>
              <Switch
                value={includeSelf}
                onValueChange={setIncludeSelf}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="What's this for?"
                placeholderTextColor={colors.textMuted}
                maxLength={500}
                editable={!submitting}
              />
            </View>

            {/* Amount + Currency */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountRow}>
                <TouchableOpacity style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>
                    {CURRENCY_SYMBOLS[currency as SupportedCurrency] ?? currency}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  editable={!submitting}
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Category</Text>
              <CategoryPicker selected={category} onSelect={setCategory} disabled={submitting} />
            </View>

            {/* Split Type */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Split Type</Text>
              <SplitTypePicker selected={splitType} onSelect={setSplitType} disabled={submitting} />
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any details..."
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                multiline
                numberOfLines={3}
                editable={!submitting}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Add Expense</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
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
    gap: 20,
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyBadge: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  currencyBadgeText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  amountInput: {
    flex: 1,
  },
  notesInput: {
    height: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  friendChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  friendChipName: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  friendChipRemove: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '700',
    marginLeft: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
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
