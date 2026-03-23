import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
} from 'react-native';
import { useTheme, RADIUS, SHADOWS } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';
import { Avatar } from './avatar';
import type { GroupListItem } from '../hooks/use-api';

type GroupPickerModalProps = {
  visible: boolean;
  groups: GroupListItem[];
  onSelect: (groupId: string) => void;
  onClose: () => void;
};

/**
 * Modal overlay listing the user's groups. On selection, the parent navigates
 * to the selected group's add-expense screen.
 */
export function GroupPickerModal({
  visible,
  groups,
  onSelect,
  onClose,
}: GroupPickerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="group-picker-modal"
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Select a group</Text>

          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => onSelect(item.id)}
                activeOpacity={0.7}
                testID={`group-pick-${item.id}`}
                data-testid={`group-pick-${item.id}`}
              >
                <Avatar name={item.name} size={36} />
                <Text style={styles.groupName} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.list}
          />

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
            testID="group-picker-cancel"
            data-testid="group-picker-cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      paddingTop: 20,
      paddingBottom: 36,
      maxHeight: '60%',
      ...SHADOWS.lg,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    list: {
      paddingHorizontal: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 56,
    },
    groupName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
