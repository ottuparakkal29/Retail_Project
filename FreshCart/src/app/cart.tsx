import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { useCart } from '@/contexts/cart-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';

export default function CartScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const { items, itemCount, subtotal, addItem, setItemQuantity, removeItem, clearCart } = useCart();
  const [notice, setNotice] = useState('');
  const deliveryFee = subtotal === 0 || subtotal >= 499 ? 0 : 40;
  const total = subtotal + deliveryFee;

  function placeDemoOrder() {
    if (!items.length) return;
    clearCart();
    setNotice('Demo order placed. It was not sent to a store or saved.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.pageScroll}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={styles.brand}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
              <View>
                <Text style={styles.brandName}>FreshCart</Text>
                <Text style={styles.brandCaption}>FRESHNESS AT YOUR DOOR</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
              <Text style={styles.continueButtonText}>‹ Continue shopping</Text>
            </Pressable>
          </View>

          <View style={styles.heading}>
            <View>
              <Text style={styles.eyebrow}>YOUR FRESH PICKS</Text>
              <Text style={styles.title}>Shopping cart</Text>
              <Text style={styles.subtitle}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart
              </Text>
            </View>
            {items.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  clearCart();
                  setNotice('');
                }}
                style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear cart</Text>
              </Pressable>
            ) : null}
          </View>

          {notice ? (
            <View accessibilityLiveRegion="polite" style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}><Text style={styles.emptyIcon}>🛒</Text></View>
              <Text style={styles.emptyTitle}>{notice ? 'Your cart is ready for more' : 'Your cart is empty'}</Text>
              <Text style={styles.emptyMessage}>
                Find something fresh and add it to your cart. Your selected items will show up here.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}>
                <Text style={styles.shopButtonText}>Explore groceries <Text style={styles.buttonArrow}>→</Text></Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.cartLayout, isWide && styles.cartLayoutWide]}>
              <View style={styles.itemList}>
                {items.map(({ product, quantity }) => (
                  <View key={product.name} style={styles.itemCard}>
                    <Image
                      accessibilityLabel={product.name}
                      source={product.image}
                      contentFit="cover"
                      style={styles.productImage}
                    />
                    <View style={styles.itemInfo}>
                      <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productDetail}>{product.detail}</Text>
                      <Text style={styles.productPrice}>₹{product.price}</Text>
                      <View style={[styles.mobileActions, isWide && styles.mobileActionsWide]}>
                        <QuantityControl
                          quantity={quantity}
                          onDecrease={() => setItemQuantity(product.name, quantity - 1)}
                          onIncrease={() => addItem(product)}
                        />
                        <Text style={styles.lineTotal}>₹{product.price * quantity}</Text>
                      </View>
                    </View>
                    <View style={[styles.desktopItemActions, isWide && styles.desktopItemActionsWide]}>
                      <QuantityControl
                        quantity={quantity}
                        onDecrease={() => setItemQuantity(product.name, quantity - 1)}
                        onIncrease={() => addItem(product)}
                      />
                      <Text style={styles.lineTotal}>₹{product.price * quantity}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${product.name} from cart`}
                      onPress={() => removeItem(product.name)}
                      style={styles.removeButton}>
                      <Text style={styles.removeButtonText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={[styles.summaryCard, isWide && styles.summaryCardWide]}>
                <Text style={styles.summaryTitle}>Order summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items ({itemCount})</Text>
                  <Text style={styles.summaryValue}>₹{subtotal}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery</Text>
                  <Text style={[styles.summaryValue, deliveryFee === 0 && styles.freeDelivery]}>
                    {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
                  </Text>
                </View>
                {subtotal > 0 && subtotal < 499 ? (
                  <Text style={styles.deliveryHint}>Add ₹{499 - subtotal} more for free delivery.</Text>
                ) : null}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₹{total}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={placeDemoOrder}
                  style={({ pressed }) => [styles.checkoutButton, pressed && styles.pressed]}>
                  <Text style={styles.checkoutButtonText}>Place demo order</Text>
                  <Text style={styles.checkoutArrow}>→</Text>
                </Pressable>
                <Text style={styles.checkoutNote}>
                  Demo checkout only. Orders are not sent or saved.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuantityControl({
  onDecrease,
  onIncrease,
  quantity,
}: {
  onDecrease: () => void;
  onIncrease: () => void;
  quantity: number;
}) {
  return (
    <View style={styles.quantityControl}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        onPress={onDecrease}
        style={styles.quantityButton}>
        <Text style={styles.quantityButtonText}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`Quantity ${quantity}`} style={styles.quantityValue}>{quantity}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        onPress={onIncrease}
        style={styles.quantityButton}>
        <Text style={styles.quantityButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f8f5',
  },
  pageScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 42,
  },
  content: {
    width: '100%',
    paddingHorizontal: 16,
  },
  contentWide: {
    maxWidth: 1180,
    paddingHorizontal: 32,
  },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5ece5',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#dcf1d6',
  },
  brandMarkText: {
    color: '#1b7539',
    fontSize: 22,
    fontWeight: '900',
  },
  brandName: {
    color: '#176a35',
    fontSize: 17,
    fontWeight: '900',
  },
  brandCaption: {
    color: '#829087',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: 2,
  },
  continueButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#eaf5e9',
  },
  continueButtonText: {
    color: DARK_GREEN,
    fontSize: 10,
    fontWeight: '700',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 25,
    marginBottom: 17,
  },
  eyebrow: {
    color: '#528359',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  title: {
    color: '#24382a',
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    color: '#758278',
    fontSize: 10,
    marginTop: 4,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  clearButtonText: {
    color: '#a65249',
    fontSize: 10,
    fontWeight: '700',
  },
  notice: {
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    borderRadius: 10,
    backgroundColor: '#eef8ec',
  },
  noticeText: {
    color: '#326643',
    fontSize: 10,
    lineHeight: 15,
  },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 42,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  emptyIconWrap: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: '#edf7e9',
  },
  emptyIcon: {
    fontSize: 29,
  },
  emptyTitle: {
    color: '#293b2f',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
  },
  emptyMessage: {
    maxWidth: 360,
    color: '#7d8a80',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 6,
  },
  shopButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 17,
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: GREEN,
  },
  shopButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  buttonArrow: {
    fontSize: 14,
  },
  cartLayout: {
    gap: 14,
  },
  cartLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemList: {
    flex: 1,
    gap: 10,
  },
  itemCard: {
    minHeight: 124,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  productImage: {
    width: 82,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#f1f5f1',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: '#293b2f',
    fontSize: 11,
    fontWeight: '800',
  },
  productDetail: {
    color: '#87938a',
    fontSize: 9,
    marginTop: 3,
  },
  productPrice: {
    color: DARK_GREEN,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
  },
  mobileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  mobileActionsWide: {
    display: 'none',
  },
  desktopItemActions: {
    display: 'none',
  },
  desktopItemActionsWide: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    marginRight: 4,
  },
  quantityControl: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e9e2',
    borderRadius: 9,
    backgroundColor: '#fbfcfb',
  },
  quantityButton: {
    width: 31,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: '#347044',
    fontSize: 17,
    fontWeight: '600',
  },
  quantityValue: {
    minWidth: 22,
    color: '#34463a',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  lineTotal: {
    color: '#2c4832',
    fontSize: 11,
    fontWeight: '800',
  },
  removeButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    color: '#b6534a',
    fontSize: 21,
    lineHeight: 25,
  },
  summaryCard: {
    padding: 17,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  summaryCardWide: {
    width: 310,
  },
  summaryTitle: {
    color: '#293b2f',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  summaryLabel: {
    color: '#748078',
    fontSize: 10,
  },
  summaryValue: {
    color: '#45554a',
    fontSize: 10,
    fontWeight: '700',
  },
  freeDelivery: {
    color: '#328149',
  },
  deliveryHint: {
    color: '#96804c',
    fontSize: 9,
    marginTop: -4,
    marginBottom: 10,
  },
  summaryDivider: {
    height: 1,
    marginVertical: 3,
    backgroundColor: '#e9eee9',
  },
  totalLabel: {
    color: '#293b2f',
    fontSize: 12,
    fontWeight: '800',
  },
  totalValue: {
    color: DARK_GREEN,
    fontSize: 15,
    fontWeight: '900',
  },
  checkoutButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 8,
    borderRadius: 11,
    backgroundColor: GREEN,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  checkoutArrow: {
    color: '#d8efcf',
    fontSize: 17,
  },
  checkoutNote: {
    color: '#8a958c',
    fontSize: 8,
    lineHeight: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  pressed: {
    opacity: 0.76,
  },
});
