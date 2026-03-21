import { useMemo } from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme, RADIUS, SHADOWS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type CardProps = ViewProps;

export function Card({ style, children, ...props }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.sm,
    },
  });
