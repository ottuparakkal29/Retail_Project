import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { getFulfillmentLabel, getPaymentLabel, type Order, type OrderItem } from '@/lib/orders';

export function OrderItemsList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: OrderItem[];
}) {
  if (!items.length) return <Text style={styles.emptyItems}>{emptyLabel}</Text>;

  return (
    <View style={styles.items}>
      {items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <View style={styles.itemCopy}>
            <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetail}>
              {formatQuantity(item.quantity)} × {formatCurrency(item.unitPrice)}
            </Text>
          </View>
          <Text style={styles.itemTotal}>{formatCurrency(item.totalPrice)}</Text>
        </View>
      ))}
    </View>
  );
}

export function OrderTotals({
  order,
}: {
  order: Pick<Order, 'subtotal' | 'deliveryCharge' | 'totalAmount' | 'fulfillmentType'>;
}) {
  return (
    <View style={styles.totals}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Items subtotal</Text>
        <Text style={styles.totalValue}>{formatCurrency(order.subtotal)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {order.fulfillmentType === 'pickup' ? 'Store pickup' : 'Delivery charge'}
        </Text>
        <Text style={styles.totalValue}>
          {order.deliveryCharge > 0 ? formatCurrency(order.deliveryCharge) : 'Free'}
        </Text>
      </View>
      <View style={styles.grandRow}>
        <Text style={styles.grandLabel}>Total</Text>
        <Text style={styles.grandValue}>{formatCurrency(order.totalAmount)}</Text>
      </View>
    </View>
  );
}

export function OrderChips({
  order,
}: {
  order: Pick<Order, 'fulfillmentType' | 'paymentMethod' | 'paymentStatus'>;
}) {
  return (
    <View style={styles.chips}>
      <View style={styles.chip}>
        <Text style={styles.chipText}>
          {order.fulfillmentType === 'pickup' ? '🏪' : '🛵'} {getFulfillmentLabel(order.fulfillmentType)}
        </Text>
      </View>
      <View style={styles.chip}>
        <Text style={styles.chipText}>💵 {getPaymentLabel(order.paymentMethod)}</Text>
      </View>
      <View style={[styles.chip, order.paymentStatus === 'paid' ? styles.paidChip : styles.unpaidChip]}>
        <Text
          style={[
            styles.chipText,
            order.paymentStatus === 'paid' ? styles.paidChipText : styles.unpaidChipText,
          ]}>
          {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  items: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  itemDetail: {
    color: Palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  itemTotal: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyItems: {
    color: Palette.muted,
    fontSize: 11,
  },
  totals: {
    gap: 7,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: Palette.muted,
    fontSize: 11,
  },
  totalValue: {
    color: '#45554a',
    fontSize: 11,
    fontWeight: '700',
  },
  grandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#edf1ed',
  },
  grandLabel: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  grandValue: {
    color: Palette.darkGreen,
    fontSize: 16,
    fontWeight: '900',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Palette.tint,
  },
  chipText: {
    color: '#3f5645',
    fontSize: 10,
    fontWeight: '600',
  },
  paidChip: {
    backgroundColor: '#e0f3e4',
  },
  paidChipText: {
    color: '#146b32',
    fontWeight: '800',
  },
  unpaidChip: {
    backgroundColor: Palette.warningBackground,
  },
  unpaidChipText: {
    color: Palette.warning,
    fontWeight: '800',
  },
});
