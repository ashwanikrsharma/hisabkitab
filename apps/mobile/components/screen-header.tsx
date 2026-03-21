import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
};

export function ScreenHeader({ title, showBack = true, rightElement }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backButton}>{'<'} Back</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {rightElement ?? <View style={styles.spacer} />}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    backButton: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '500',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    spacer: {
      width: 60,
    },
  });
