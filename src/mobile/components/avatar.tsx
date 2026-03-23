import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getInitials } from '@hisabkitab/shared';
import { useTheme } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

const AVATAR_COLORS = [
  '#E8651A', '#48bb78', '#4299e1', '#ed64a6', '#ecc94b',
  '#9f7aea', '#38b2ac', '#fc8181', '#667eea', '#f6ad55',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

type AvatarProps = {
  name: string;
  size?: number;
};

export function Avatar({ name, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const safeName = name || 'User';
  const bg = hashColor(safeName);
  const initials = getInitials(safeName);
  const fontSize = size * 0.4;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      color: colors.text,
      fontWeight: '700',
    },
  });
