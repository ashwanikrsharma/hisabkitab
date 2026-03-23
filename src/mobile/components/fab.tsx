import { useMemo, useState, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, RADIUS, SHADOWS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

type FabAction = {
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

type FabProps = {
  actions: FabAction[];
  testID?: string;
};

/**
 * Expandable floating action button — shows a "+" that rotates to "x" when
 * expanded, revealing action options above it (matching the web app's pattern).
 */
export function Fab({ actions, testID }: FabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const handleAction = useCallback(
    (action: FabAction) => {
      setExpanded(false);
      action.onPress();
    },
    [],
  );

  return (
    <>
      {/* Backdrop overlay when expanded */}
      {expanded && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setExpanded(false)}
        />
      )}

      <View style={styles.fabContainer} pointerEvents="box-none">
        {/* Action items — shown when expanded */}
        {expanded &&
          actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionRow}
              onPress={() => handleAction(action)}
              activeOpacity={0.8}
            >
              <View style={styles.actionLabel}>
                <Text style={styles.actionTitle}>{action.label}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </View>
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon} size={20} color={colors.text} />
              </View>
            </TouchableOpacity>
          ))}

        {/* Main FAB button */}
        <TouchableOpacity
          style={[styles.fab, expanded && styles.fabExpanded]}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Close menu' : 'Add expense'}
          testID={testID}
        >
          <Text style={[styles.icon, expanded && styles.iconExpanded]}>
            {expanded ? '\u00d7' : '+'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 9,
    },
    fabContainer: {
      position: 'absolute',
      bottom: 96,
      right: 20,
      alignItems: 'flex-end',
      zIndex: 10,
      gap: 12,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOWS.lg,
    },
    fabExpanded: {
      backgroundColor: colors.text,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    icon: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 30,
    },
    iconExpanded: {
      fontSize: 24,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    actionLabel: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      paddingVertical: 10,
      paddingHorizontal: 16,
      ...SHADOWS.md,
      minWidth: 160,
    },
    actionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    actionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOWS.md,
    },
  });
