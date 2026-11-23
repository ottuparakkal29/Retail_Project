import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { getStatusMeta, type StatusTone } from '@/lib/orders';

const TONES: Record<StatusTone, { background: string; color: string }> = {
  warning: { background: '#fff3d6', color: '#8a5a00' },
  info: { background: '#e6f0fb', color: '#1f5a99' },
  progress: { background: '#fdeadb', color: '#a0520c' },
  success: { background: '#e0f3e4', color: '#146b32' },
  danger: { background: '#fdecea', color: '#a32f2a' },
  neutral: { background: '#eceeed', color: '#5b675e' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  const tone = TONES[meta.tone];

  return (
    <View
      accessibilityLabel={`Status: ${meta.label}`}
      style={[styles.badge, { backgroundColor: tone.background }]}>
      <View style={[styles.dot, { backgroundColor: tone.color }]} />
      <Text style={[styles.label, { color: tone.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
