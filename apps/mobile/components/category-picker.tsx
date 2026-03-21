import { useMemo } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, type ExpenseCategory } from '@hisabkitab/shared';
import { useTheme, RADIUS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type CategoryPickerProps = {
  selected: ExpenseCategory;
  onSelect: (category: ExpenseCategory) => void;
  disabled?: boolean;
};

export function CategoryPicker({ selected, onSelect, disabled }: CategoryPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {EXPENSE_CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[styles.pill, selected === cat && styles.pillSelected]}
          onPress={() => onSelect(cat)}
          disabled={disabled}
        >
          <Text style={styles.emoji}>{CATEGORY_ICONS[cat]}</Text>
          <Text style={[styles.label, selected === cat && styles.labelSelected]}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      gap: 8,
      paddingVertical: 4,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    pillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    emoji: {
      fontSize: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    labelSelected: {
      color: colors.text,
      fontWeight: '600',
    },
  });
