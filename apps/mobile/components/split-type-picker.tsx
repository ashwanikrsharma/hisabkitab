import { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SPLIT_TYPES, type SplitType } from '@hisabkitab/shared';
import { useTheme, RADIUS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type SplitTypePickerProps = {
  selected: SplitType;
  onSelect: (type: SplitType) => void;
  disabled?: boolean;
};

export function SplitTypePicker({ selected, onSelect, disabled }: SplitTypePickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {SPLIT_TYPES.map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.option, selected === type && styles.optionSelected]}
          onPress={() => onSelect(type)}
          disabled={disabled}
        >
          <Text style={[styles.text, selected === type && styles.textSelected]}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    option: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    optionSelected: {
      backgroundColor: colors.primary,
    },
    text: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    textSelected: {
      color: colors.text,
      fontWeight: '600',
    },
  });
