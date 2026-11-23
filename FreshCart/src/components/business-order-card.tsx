import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { OrderChips, OrderItemsList, OrderTotals } from '@/components/order-parts';
import { Palette } from '@/constants/palette';
import { formatDateTime } from '@/lib/format';
import { getBusinessActions, type BusinessAction, type Order } from '@/lib/orders';

type BusinessOrderCardProps = {
  order: Order;
  busy: boolean;
  onAction: (order: Order, action: BusinessAction) => void;
};

export function BusinessOrderCard({ order, busy, onAction }: BusinessOrderCardProps) {
  const actions = getBusinessActions(order);
  // An order row arrives before its items, so keep it read-only until the items are in.
  const waitingForItems = order.items.length === 0;
  const isDelivery = order.fulfillmentType === 'delivery';

  function callCustomer() {
    Linking.openURL(`tel:${order.customerPhone.replace(/[^\d+]/g, '')}`).catch(() => undefined);
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text selectable style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <OrderChips order={order} />

      <View style={styles.customerBox}>
        <View style={styles.customerRow}>
          <View style={styles.customerCopy}>
            <Text style={styles.detailLabel}>Customer phone</Text>
            <Text selectable style={styles.detailValue}>
              {order.customerPhone || 'No phone number given'}
            </Text>
          </View>
          {order.customerPhone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Call customer ${order.customerPhone}`}
              onPress={callCustomer}
              style={({ pressed }) => [styles.callButton, pressed && styles.dimmed]}>
              <Text style={styles.callButtonText}>📞 Call</Text>
            </Pressable>
          ) : null}
        </View>
        {isDelivery ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Delivery address</Text>
            <Text selectable style={styles.detailValue}>
              {order.deliveryAddress || 'No address given'}
            </Text>
          </View>
        ) : (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Fulfilment</Text>
            <Text style={styles.detailValue}>Customer will collect this order from your shop.</Text>
          </View>
        )}
        {order.customerNotes ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Customer notes</Text>
            <Text selectable style={styles.detailValue}>{order.customerNotes}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Items{order.items.length ? ` (${order.items.length})` : ''}
        </Text>
        <OrderItemsList emptyLabel="Loading the items for this order…" items={order.items} />
      </View>

      <View style={styles.section}>
        <OrderTotals order={order} />
      </View>

      {order.status === 'rejected' ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Rejection reason</Text>
          <Text style={styles.reasonText}>{order.rejectionReason || 'No reason recorded.'}</Text>
        </View>
      ) : null}

      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => {
            const disabled = busy || waitingForItems;
            return (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityState={{ busy, disabled }}
                disabled={disabled}
                onPress={() => onAction(order, action)}
                style={({ pressed }) => [
                  styles.actionButton,
                  action.destructive ? styles.destructiveButton : styles.primaryButton,
                  (pressed || disabled) && styles.dimmed,
                ]}>
                {busy && !action.destructive ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text
                    style={action.destructive ? styles.destructiveButtonText : styles.primaryButtonText}>
                    {action.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
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
  date: {
    color: Palette.muted,
    fontSize: 10,
    marginTop: 3,
  },
  customerBox: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f6f9f5',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  customerCopy: {
    flex: 1,
    minWidth: 0,
  },
  callButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    backgroundColor: Palette.surface,
  },
  callButtonText: {
    color: Palette.darkGreen,
    fontSize: 11,
    fontWeight: '700',
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 140,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  primaryButton: {
    backgroundColor: Palette.green,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  destructiveButton: {
    borderWidth: 1,
    borderColor: Palette.dangerBorder,
    backgroundColor: Palette.dangerBackground,
  },
  destructiveButtonText: {
    color: Palette.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  dimmed: {
    opacity: 0.55,
  },
});
