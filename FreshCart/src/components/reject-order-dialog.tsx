import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';
import { MAX_REJECTION_REASON_LENGTH } from '@/lib/orders';

type RejectOrderDialogProps = {
  orderNumber: string | null;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

// Prompts for the reason shown to the customer. Mount it only while an order is being rejected so the text resets.
export function RejectOrderDialog({ orderNumber, loading, onConfirm, onCancel }: RejectOrderDialogProps) {
  if (!orderNumber) return null;
  return (
    <RejectOrderForm
      loading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
      orderNumber={orderNumber}
    />
  );
}

function RejectOrderForm({
  loading,
  onCancel,
  onConfirm,
  orderNumber,
}: Omit<RejectOrderDialogProps, 'orderNumber'> & { orderNumber: string }) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !loading;

  return (
    <Modal
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          disabled={loading}
          importantForAccessibility="no"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal role="alertdialog" style={styles.card}>
          <Text style={styles.title}>Reject order {orderNumber}?</Text>
          <Text style={styles.message}>
            Tell the customer why you can’t take this order. They will see this reason in their order history.
          </Text>
          <TextInput
            accessibilityLabel="Reason for rejecting this order"
            autoFocus
            editable={!loading}
            maxLength={MAX_REJECTION_REASON_LENGTH}
            multiline
            onChangeText={setReason}
            placeholder="e.g. Item out of stock"
            placeholderTextColor="#a1aba2"
            style={styles.input}
            value={reason}
          />
          <Text style={styles.counter}>
            {reason.length}/{MAX_REJECTION_REASON_LENGTH}
          </Text>
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
              <Text style={styles.cancelText}>Keep order</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={() => onConfirm(trimmed)}
              style={({ pressed }) => [
                styles.button,
                styles.rejectButton,
                (pressed || !canSubmit) && styles.dimmed,
              ]}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.rejectText}>Reject order</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 420,
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
  input: {
    minHeight: 84,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d8e4d8',
    borderRadius: 10,
    backgroundColor: '#fcfdfb',
    color: Palette.text,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#8a958c',
    fontSize: 10,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  button: {
    minWidth: 110,
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
  rejectButton: {
    backgroundColor: '#c0392b',
  },
  cancelText: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rejectText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.6,
  },
});
