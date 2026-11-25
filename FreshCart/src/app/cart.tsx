import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { CheckoutModal } from '@/components/checkout-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ProductImage } from '@/components/product-image';
import { QuantityStepper } from '@/components/quantity-stepper';
import { SkeletonBlock, SkeletonGroup } from '@/components/skeleton';
import { Palette } from '@/constants/palette';
import {
  canIncreaseQuantity,
  getCartItemIssue,
  useCart,
  type CartItem,
  type CartItemIssue,
} from '@/contexts/cart-context';
import { useNavigationState } from '@/contexts/navigation-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { DELIVERY_CHARGE, FREE_DELIVERY_THRESHOLD } from '@/lib/orders';

const GREEN = Palette.green;
const DARK_GREEN = Palette.darkGreen;

function issueMessage(issue: CartItemIssue, item: CartItem) {
  if (issue === 'out-of-stock') return 'Out of stock. Remove it to continue.';
  if (issue === 'limited-stock') {
    return `Only ${formatQuantity(item.product?.stock ?? 0)} left in stock. Reduce the quantity to continue.`;
  }
  return 'No longer available. Remove it to continue.';
}

export default function CartScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const isDesktop = useResponsiveBreakpoint(760);
  const { setAuthRequest } = useNavigationState();
  const {
    status,
    access,
    items,
    shop,
    hasMultipleShops,
    itemCount,
    subtotal,
    loadError,
    error: cartError,
    isBusy,
    isPending,
    refresh,
    addItem,
    setItemQuantity,
    removeItem,
    clearCart,
    dismissError,
  } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const hasItemIssue = items.some((item) => getCartItemIssue(item) !== null);
  const checkoutBlocked = hasMultipleShops || hasItemIssue;
  const freeDeliveryGap = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  async function confirmClearCart() {
    setClearing(true);
    try {
      await clearCart();
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  function signIn() {
    setAuthRequest('login');
    router.push('/');
  }

  let content;
  if (status === 'loading') {
    content = <CartSkeleton />;
  } else if (status === 'error') {
    content = (
      <StateCard
        actionLabel="Try again"
        icon="⚠"
        message={loadError || 'Unable to load your cart. Please try again.'}
        onAction={() => void refresh()}
        title="Couldn’t load your cart"
      />
    );
  } else if (access === 'signed-out') {
    content = (
      <StateCard
        actionLabel="Sign in"
        icon="🔒"
        message="Sign in with your customer account to see your cart and place orders."
        onAction={signIn}
        title="Sign in to view your cart"
      />
    );
  } else if (access === 'restricted') {
    content = (
      <StateCard
        actionLabel="Back to shops"
        icon="🛒"
        message="Only customer accounts can use the cart and place orders."
        onAction={() => router.replace('/')}
        title="Cart is for customers"
      />
    );
  } else if (items.length === 0) {
    content = (
      <StateCard
        actionLabel="Explore shops"
        icon="🛒"
        message="Find something fresh and add it to your cart. Your selected items will show up here."
        onAction={() => router.replace('/')}
        title="Your cart is empty"
      />
    );
  } else {
    content = (
      <View style={[styles.cartLayout, isWide && styles.cartLayoutWide]}>
        <View style={styles.itemList}>
          {shop ? (
            <View style={styles.shopBanner}>
              <Text style={styles.shopBannerLabel}>ORDERING FROM</Text>
              <Text numberOfLines={1} style={styles.shopBannerName}>{shop.name}</Text>
              {shop.location ? (
                <Text numberOfLines={1} style={styles.shopBannerLocation}>⌖ {shop.location}</Text>
              ) : null}
            </View>
          ) : null}
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              isWide={isWide}
              item={item}
              onDecrease={() => void setItemQuantity(item.productId, item.quantity - 1)}
              onIncrease={() => item.product && void addItem(item.product)}
              onRemove={() => void removeItem(item.productId)}
              pending={isPending(item.productId)}
            />
          ))}
        </View>

        <View style={[styles.summaryCard, isWide && styles.summaryCardWide]}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items</Text>
            <Text style={styles.summaryValue}>{formatQuantity(itemCount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>Choose at checkout</Text>
          </View>
          <Text style={styles.deliveryHint}>
            Home delivery is {formatCurrency(DELIVERY_CHARGE)}, free on orders of{' '}
            {formatCurrency(FREE_DELIVERY_THRESHOLD)} or more. Store pickup is always free.
            {freeDeliveryGap > 0 && subtotal > 0
              ? ` Add ${formatCurrency(freeDeliveryGap)} more for free delivery.`
              : ''}
          </Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {checkoutBlocked ? (
            <Text accessibilityRole="alert" style={styles.blockedNote}>
              {hasMultipleShops
                ? 'Your cart has items from more than one shop. Remove the extra items to check out.'
                : 'Fix the highlighted items to continue.'}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: checkoutBlocked || isBusy }}
            disabled={checkoutBlocked || isBusy}
            onPress={() => setCheckoutOpen(true)}
            style={({ pressed }) => [
              styles.checkoutButton,
              (pressed || checkoutBlocked || isBusy) && styles.dimmed,
            ]}>
            <Text style={styles.checkoutButtonText}>Proceed to checkout</Text>
            <Text style={styles.checkoutArrow}>→</Text>
          </Pressable>
          <Text style={styles.checkoutNote}>
            💵 Choose cash on delivery or online payment at checkout.
          </Text>
        </View>
      </View>
    );
  }

  const showCartDetails = status === 'ready' && access === 'customer' && items.length > 0;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.pageScroll, { paddingBottom: isDesktop ? 42 : 110 }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
              <Text style={styles.continueButtonText}>‹ Continue shopping</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/orders')}
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
              <Text style={styles.continueButtonText}>My orders</Text>
            </Pressable>
          </View>

          <View style={styles.heading}>
            <View>
              <Text style={styles.eyebrow}>YOUR FRESH PICKS</Text>
              <Text style={styles.title}>Shopping cart</Text>
              <Text style={styles.subtitle}>
                {formatQuantity(itemCount)} {itemCount === 1 ? 'item' : 'items'} in your cart
              </Text>
            </View>
            {showCartDetails ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => setConfirmingClear(true)}
                style={[styles.clearButton, isBusy && styles.dimmed]}>
                <Text style={styles.clearButtonText}>Clear cart</Text>
              </Pressable>
            ) : null}
          </View>

          {cartError ? (
            <Pressable
              accessibilityRole="alert"
              onPress={dismissError}
              style={[styles.notice, styles.errorNotice]}>
              <Text style={styles.errorNoticeText}>{cartError}</Text>
              <Text style={styles.errorDismiss}>×</Text>
            </Pressable>
          ) : null}

          {content}
        </View>
      </ScrollView>

      <ConfirmDialog
        confirmLabel="Clear cart"
        destructive
        loading={clearing}
        message="This removes every item from your cart."
        onCancel={() => setConfirmingClear(false)}
        onConfirm={() => void confirmClearCart()}
        title="Clear your cart?"
        visible={confirmingClear}
      />
      <CheckoutModal onClose={() => setCheckoutOpen(false)} visible={checkoutOpen} />
    </SafeAreaView>
  );
}

function CartItemRow({
  isWide,
  item,
  onDecrease,
  onIncrease,
  onRemove,
  pending,
}: {
  isWide: boolean;
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
  pending: boolean;
}) {
  const { product } = item;
  const issue = getCartItemIssue(item);

  if (!product) {
    return (
      <View style={[styles.itemCard, styles.itemCardIssue]}>
        <View style={styles.itemInfo}>
          <Text style={styles.productName}>Item unavailable</Text>
          <Text style={styles.issueText}>{issueMessage('unavailable', item)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove unavailable item from cart"
          disabled={pending}
          onPress={onRemove}
          style={[styles.removeButton, pending && styles.dimmed]}>
          <Text style={styles.removeButtonText}>×</Text>
        </Pressable>
      </View>
    );
  }

  const stepper = (
    <QuantityStepper
      canIncrease={canIncreaseQuantity(product, item.quantity)}
      loading={pending}
      onDecrease={onDecrease}
      onIncrease={onIncrease}
      productName={product.name}
      quantity={item.quantity}
    />
  );

  return (
    <View style={[styles.itemCard, issue && styles.itemCardIssue]}>
      <ProductImage fallbackFontSize={26} name={product.name} style={styles.productImage} uri={product.image} />
      <View style={styles.itemInfo}>
        <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
        <Text style={styles.productDetail}>{product.unit}</Text>
        <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
        {issue ? <Text style={styles.issueText}>{issueMessage(issue, item)}</Text> : null}
        {!isWide ? (
          <View style={styles.mobileActions}>
            {stepper}
            <Text style={styles.lineTotal}>{formatCurrency(item.lineTotal)}</Text>
          </View>
        ) : null}
      </View>
      {isWide ? (
        <View style={styles.desktopActions}>
          {stepper}
          <Text style={styles.lineTotal}>{formatCurrency(item.lineTotal)}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${product.name} from cart`}
        disabled={pending}
        onPress={onRemove}
        style={[styles.removeButton, pending && styles.dimmed]}>
        <Text style={styles.removeButtonText}>×</Text>
      </Pressable>
    </View>
  );
}

function CartSkeleton() {
  return (
    <SkeletonGroup label="Loading your cart" style={styles.skeletonList}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.itemCard}>
          <SkeletonBlock height={88} radius={10} width={82} />
          <View style={styles.skeletonCopy}>
            <SkeletonBlock height={12} width="70%" />
            <SkeletonBlock height={10} width="30%" />
            <SkeletonBlock height={32} radius={16} width={110} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

function StateCard({
  actionLabel,
  icon,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  icon: string;
  message: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}><Text style={styles.emptyIcon}>{icon}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}>
        <Text style={styles.shopButtonText}>{actionLabel} <Text style={styles.buttonArrow}>→</Text></Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    borderRadius: 10,
    backgroundColor: '#eef8ec',
  },
  errorNotice: {
    borderColor: Palette.dangerBorder,
    backgroundColor: Palette.dangerBackground,
  },
  errorNoticeText: {
    flex: 1,
    color: Palette.danger,
    fontSize: 11,
  },
  errorDismiss: {
    color: Palette.danger,
    fontSize: 20,
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
    fontSize: 11,
    lineHeight: 17,
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
    fontSize: 11,
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
  shopBanner: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#d9e9d9',
    borderRadius: 14,
    backgroundColor: '#eef8ec',
  },
  shopBannerLabel: {
    color: '#528359',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  shopBannerName: {
    color: DARK_GREEN,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  shopBannerLocation: {
    color: '#68806c',
    fontSize: 10,
    marginTop: 2,
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
  itemCardIssue: {
    borderColor: Palette.dangerBorder,
    backgroundColor: '#fffafa',
  },
  productImage: {
    width: 82,
    height: 88,
    borderRadius: 10,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: '#293b2f',
    fontSize: 12,
    fontWeight: '800',
  },
  productDetail: {
    color: '#87938a',
    fontSize: 10,
    marginTop: 3,
  },
  productPrice: {
    color: DARK_GREEN,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  issueText: {
    color: Palette.danger,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  mobileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  desktopActions: {
    alignItems: 'flex-end',
    gap: 8,
    marginRight: 4,
  },
  lineTotal: {
    color: '#2c4832',
    fontSize: 12,
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
  skeletonList: {
    gap: 10,
  },
  skeletonCopy: {
    flex: 1,
    gap: 10,
  },
  summaryCard: {
    padding: 17,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  summaryCardWide: {
    width: 320,
  },
  summaryTitle: {
    color: '#293b2f',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 11,
  },
  summaryLabel: {
    flexShrink: 1,
    color: '#748078',
    fontSize: 11,
  },
  summaryValue: {
    color: '#45554a',
    fontSize: 11,
    fontWeight: '700',
  },
  deliveryHint: {
    color: '#7f7442',
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 12,
  },
  summaryDivider: {
    height: 1,
    marginVertical: 3,
    marginBottom: 12,
    backgroundColor: '#e9eee9',
  },
  totalLabel: {
    color: '#293b2f',
    fontSize: 13,
    fontWeight: '800',
  },
  totalValue: {
    color: DARK_GREEN,
    fontSize: 16,
    fontWeight: '900',
  },
  blockedNote: {
    color: Palette.danger,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 8,
  },
  checkoutButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: GREEN,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  checkoutArrow: {
    color: '#d8efcf',
    fontSize: 17,
  },
  checkoutNote: {
    color: '#8a958c',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  pressed: {
    opacity: 0.76,
  },
  dimmed: {
    opacity: 0.55,
  },
});
