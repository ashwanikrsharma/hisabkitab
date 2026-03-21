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
import { useAuthStore } from '../../store/auth';
import { useCreateSettlement } from '../../hooks/use-api';
import { useTheme, RADIUS } from '../../lib/theme';
import type { ColorTokens } from '../../lib/theme';
import { ScreenHeader } from '../../components/screen-header';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Bank Transfer'] as const;

export default function DirectSettleScreen() {
  const { payeeId, payeeName, amount: prefillAmount, currency: prefillCurrency } = useLocalSearchParams<{
    payeeId: string;
    payeeName?: string;
    amount?: string;
    currency?: string;
  }>();

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const [amount, setAmount] = useState(prefillAmount ?? '');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [upiId, setUpiId] = useState('');
  const [note, setNote] = useState('');

  const settleMutation = useCreateSettlement();
  const submitting = settleMutation.isPending;

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }
    if (!userId || !payeeId) {
      Alert.alert('Error', 'Missing user information.');
      return;
    }

    const noteText = [
      paymentMethod,
      upiId.trim() ? `UPI: ${upiId.trim()}` : '',
      note.trim(),
    ].filter(Boolean).join(' | ');

    settleMutation.mutate(
      {
        payerId: userId,
        payeeId,
        amount: parsedAmount,
        currency: prefillCurrency ?? 'INR',
        note: noteText || 'Settled via app',
      },
      {
        onSuccess: () => {
          Alert.alert('Settled', 'Payment recorded successfully.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
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
          <ScreenHeader title="Settle Up" />

          {payeeName && (
            <Text style={styles.payeeLabel}>
              Paying <Text style={styles.payeeName}>{payeeName}</Text>
            </Text>
          )}

          <View style={styles.form}>
            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountRow}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>{prefillCurrency ?? 'INR'}</Text>
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

            {/* Payment Method */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Payment Method</Text>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodOption,
                      paymentMethod === method && styles.methodOptionSelected,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.methodOptionText,
                        paymentMethod === method && styles.methodOptionTextSelected,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* UPI ID (only if UPI selected) */}
            {paymentMethod === 'UPI' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>UPI ID (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="name@upi"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                />
              </View>
            )}

            {/* Note */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Any details..."
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                multiline
                numberOfLines={2}
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
              <Text style={styles.submitButtonText}>Record Payment</Text>
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
  payeeLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  payeeName: {
    fontWeight: '700',
    color: colors.text,
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
  methodRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  methodOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  methodOptionSelected: {
    backgroundColor: colors.primary,
  },
  methodOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  methodOptionTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  noteInput: {
    height: 72,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.success,
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
