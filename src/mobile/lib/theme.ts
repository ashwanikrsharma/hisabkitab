// ─── HisabKitab Mobile Theme Constants ──────────────────────────────────────
import { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';

export type ThemeMode = 'light' | 'dark';

type ColorTokens = {
  bg: string;
  card: string;
  border: string;
  primary: string;
  primaryLight: string;
  success: string;
  danger: string;
  warning: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  tabInactive: string;
};

const DARK_COLORS: ColorTokens = {
  bg: '#1a1a2e',
  card: '#2d2d44',
  border: '#3d3d5c',
  primary: '#E8651A',
  primaryLight: '#FF8A47',
  success: '#48bb78',
  danger: '#fc8181',
  warning: '#f6e05e',
  text: '#ffffff',
  textSecondary: '#a0aec0',
  textMuted: '#718096',
  tabInactive: '#a0aec0',
};

const LIGHT_COLORS: ColorTokens = {
  bg: '#f7f7fa',
  card: '#ffffff',
  border: '#e2e2ea',
  primary: '#E8651A',
  primaryLight: '#FF8A47',
  success: '#2f855a',
  danger: '#c53030',
  warning: '#b7791f',
  text: '#1a1a2e',
  textSecondary: '#4a5568',
  textMuted: '#a0aec0',
  tabInactive: '#a0aec0',
};

export function getColors(mode: ThemeMode): ColorTokens {
  return mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

// Backward compat — default to dark so existing static references still work
export const COLORS = DARK_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 20,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  title: 28,
  hero: 36,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
} as const;

// ─── Theme Context ───────────────────────────────────────────────────────────

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ColorTokens;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: LIGHT_COLORS,
  setMode: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Creates memoized styles that react to theme changes.
 * Usage:
 *   const styles = useThemeStyles((colors) => StyleSheet.create({ ... }));
 */
export function useThemeStyles<T>(factory: (colors: ColorTokens) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}

export type { ColorTokens };
