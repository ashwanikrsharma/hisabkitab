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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { type SplitType, type ExpenseCategory } from '@hisabkitab/shared';
import { useAuthStore } from '../../../../store/auth';
import { useCreateExpense, useGroupDetail } from '../../../../hooks/use-api';
import { useTheme, RADIUS } from '../../../../lib/theme';
import type { ColorTokens } from '../../../../lib/theme';
import { ScreenHeader } from '../../../../components/screen-header';
import { CategoryPicker } from '../../../../components/category-picker';
import { SplitTypePicker } from '../../../../components/split-type-picker';
import { SplitDetailInput } from '../../../../components/split-detail-input';

export default function AddExpenseScreen() {
  const { id, currency: groupCurrency } = useLocalSearchParams<{
    id: string;
    currency?: string;
  }>();
  const session = useAuthStore((s) => s.session);
  const currency = groupCurrency ?? 'INR';

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [notes, setNotes] = useState('');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [splitError, setSplitError] = useState('');

  const { data: group } = useGroupDetail(id);
  const members = useMemo(
    () => (group?.members ?? []).map((m) => ({ id: m.id, name: m.name })),
    [group?.members],
  );

  const createExpense = useCreateExpense();
  const submitting = createExpense.isPending;

  const handleSubmit = () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      Alert.alert('Validation Error', 'Description is required.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Error', 'You must be logged in to add an expense.');
      return;
    }

    // Validate splits for exact/percentage
    setSplitError('');
    let splits: Array<{ userId: string; amount: number; percentage?: number }> | undefined;

    if (splitType === 'exact') {
      splits = members.map((m) => ({
        userId: m.id,
        amount: parseFloat(splitAmounts[m.id] ?? '0'),
      }));
      const sum = splits.reduce((a, b) => a + b.amount, 0);
      if (Math.abs(sum - parsedAmount) > 0.01) {
        setSplitError(
          `Amounts must sum to ${parsedAmount.toFixed(2)} (currently ${sum.toFixed(2)})`,
        );
        return;
      }
    } else if (splitType === 'percentage') {
      splits = members.map((m) => {
        const pct = parseFloat(splitAmounts[m.id] ?? '0');
        return {
          userId: m.id,
          amount: Math.round((parsedAmount * pct) / 100 * 100) / 100,
          percentage: pct,
        };
      });
      const totalPct = splits.reduce((a, b) => a + (b.percentage ?? 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        setSplitError(
          `Percentages must sum to 100% (currently ${totalPct.toFixed(1)}%)`,
        );
        return;
      }
    }

    createExpense.mutate(
      {
        groupId: id,
        description: trimmedDescription,
        amount: parsedAmount,
        currency,
        paidById: userId,
        splitType,
        category,
        createdBy: userId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(splits ? { splits } : {}),
      },
      {
        onSuccess: () => router.back(),
      },
    );
  };

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
          <ScreenHeader title="Add Expense" />

          <View style={styles.form}>
            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Dinner at Barbeque Nation"
                placeholderTextColor={colors.textMuted}
                maxLength={500}
                autoFocus
                editable={!submitting}
              />
            </View>

            {/* Amount + Currency */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountRow}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>{currency}</Text>
                </View>
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
              <CategoryPicker
                selected={category}
                onSelect={setCategory}
                disabled={submitting}
              />
            </View>

            {/* Split Type */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Split Type</Text>
              <SplitTypePicker
                selected={splitType}
                onSelect={setSplitType}
                disabled={submitting}
              />
            </View>

            {/* Split Details */}
            {members.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {splitType === 'equal'
                    ? 'Per Person'
                    : splitType === 'exact'
                      ? 'Custom Amounts'
                      : 'Percentages'}
                </Text>
                <SplitDetailInput
                  members={members}
                  splitType={splitType}
                  totalAmount={parseFloat(amount) || 0}
                  currency={currency}
                  splits={splitAmounts}
                  onChange={setSplitAmounts}
                  error={splitError}
                  disabled={submitting}
                />
              </View>
            )}

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional details..."
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

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
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
      fontSize: 16,
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
