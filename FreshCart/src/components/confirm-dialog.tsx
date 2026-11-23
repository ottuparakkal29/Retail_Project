import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// A Modal-based confirm. React Native's Alert.alert is a no-op on web, so it can't be used here.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          disabled={loading}
          importantForAccessibility="no"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal role="alertdialog" style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                (pressed || loading) && styles.dimmed,
              ]}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                (pressed || loading) && styles.dimmed,
              ]}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(14, 30, 20, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 22,
    borderRadius: 18,
    backgroundColor: Palette.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  title: {
    color: '#18351f',
    fontSize: 17,
    fontWeight: '800',
  },
  message: {
    color: Palette.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },
  button: {
    minWidth: 96,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 21,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#cfdccf',
    backgroundColor: Palette.surface,
  },
  confirmButton: {
    backgroundColor: Palette.green,
  },
  destructiveButton: {
    backgroundColor: '#c0392b',
  },
  cancelText: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.7,
  },
});
