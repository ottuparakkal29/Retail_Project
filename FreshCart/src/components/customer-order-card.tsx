import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { OrderChips, OrderItemsList, OrderTotals } from '@/components/order-parts';
import { Palette } from '@/constants/palette';
import { formatDateTime } from '@/lib/format';
import { getStatusMeta, type Order } from '@/lib/orders';

type CustomerOrderCardProps = {
  order: Order;
  cancelling: boolean;
  retryingPayment: boolean;
  onCancel: (order: Order) => void;
  onRetryPayment: (order: Order) => void;
};

export function CustomerOrderCard({
  order,
  cancelling,
  retryingPayment,
  onCancel,
  onRetryPayment,
}: CustomerOrderCardProps) {
  const note = getStatusMeta(order.status).customerNote;
  const itemCount = order.items.length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text selectable style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text numberOfLines={1} style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      {note ? <Text style={styles.statusNote}>{note}</Text> : null}

      {order.status === 'rejected' ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason from the shop</Text>
          <Text style={styles.reasonText}>
            {order.rejectionReason || 'The shop did not share a reason.'}
          </Text>
        </View>
      ) : null}

      <OrderChips order={order} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Items{itemCount ? ` (${itemCount})` : ''}
        </Text>
        <OrderItemsList emptyLabel="Item details are not available for this order." items={order.items} />
      </View>

      <View style={styles.section}>
        <OrderTotals order={order} />
      </View>

      {order.status === 'pending' &&
      order.paymentMethod === 'online' &&
      order.paymentStatus === 'unpaid' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retry payment for order ${order.orderNumber}`}
          accessibilityState={{ busy: retryingPayment, disabled: retryingPayment }}
          disabled={retryingPayment}
          onPress={() => onRetryPayment(order)}
          style={({ pressed }) => [styles.retryPaymentButton, (pressed || retryingPayment) && styles.dimmed]}>
          {retryingPayment ? (
            <ActivityIndicator color={Palette.darkGreen} size="small" />
          ) : (
            <Text style={styles.retryPaymentText}>Retry online payment</Text>
          )}
        </Pressable>
      ) : null}

      {order.fulfillmentType === 'delivery' && order.deliveryAddress ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Delivery address</Text>
          <Text style={styles.detailValue}>{order.deliveryAddress}</Text>
        </View>
      ) : null}
      {order.customerPhone ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Contact number</Text>
          <Text style={styles.detailValue}>{order.customerPhone}</Text>
        </View>
      ) : null}
      {order.customerNotes ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Your note</Text>
          <Text style={styles.detailValue}>{order.customerNotes}</Text>
        </View>
      ) : null}

      {order.status === 'pending' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel order ${order.orderNumber}`}
          accessibilityState={{ busy: cancelling, disabled: cancelling }}
          disabled={cancelling}
          onPress={() => onCancel(order)}
          style={({ pressed }) => [styles.cancelButton, (pressed || cancelling) && styles.dimmed]}>
          {cancelling ? (
            <ActivityIndicator color={Palette.danger} size="small" />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel order</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    backgroundColor: Palette.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  shopName: {
    color: Palette.darkGreen,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  date: {
    color: Palette.muted,
    fontSize: 10,
    marginTop: 2,
  },
  statusNote: {
    color: '#4f6354',
    fontSize: 11,
    lineHeight: 17,
  },
  reasonBox: {
    padding: 11,
    borderWidth: 1,
    borderColor: Palette.dangerBorder,
    borderRadius: 10,
    backgroundColor: Palette.dangerBackground,
  },
  reasonLabel: {
    color: Palette.danger,
    fontSize: 10,
    fontWeight: '800',
  },
  reasonText: {
    color: Palette.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  section: {
    gap: 9,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf1ed',
  },
  sectionTitle: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  detailBlock: {
    gap: 2,
  },
  detailLabel: {
    color: Palette.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  detailValue: {
    color: Palette.text,
    fontSize: 12,
    lineHeight: 18,
  },
  cancelButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.dangerBorder,
    borderRadius: 21,
    backgroundColor: Palette.dangerBackground,
  },
  cancelButtonText: {
    color: Palette.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  retryPaymentButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.green,
    borderRadius: 21,
    backgroundColor: '#eef8ec',
  },
  retryPaymentText: {
    color: Palette.darkGreen,
    fontSize: 12,
    fontWeight: '800',
  },
  dimmed: {
    opacity: 0.6,
  },
});
