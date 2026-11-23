import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';
import { getCartItemIssue, useCart, type CartSnapshot } from '@/contexts/cart-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency, formatQuantity, roundMoney } from '@/lib/format';
import {
  calculateTotals,
  createIdempotencyKey,
  fetchCustomerProfile,
  getDeliveryCharge,
  MAX_ADDRESS_LENGTH,
  MAX_NOTES_LENGTH,
  placeOrder,
  validateCheckoutFields,
  type CheckoutFieldErrors,
  type CustomerProfile,
  type FulfillmentType,
  type OrderDraft,
  type OrderLine,
} from '@/lib/orders';

type Phase = 'editing' | 'submitting' | 'retry' | 'placed';

type PlacedSummary = {
  orderNumber: string;
  shopName: string;
  fulfillmentType: FulfillmentType;
  totalAmount: number;
  cartCleared: boolean;
};

type Attempt = { draft: OrderDraft; shopName: string };

type PreparedLines = { businessId: string; shopName: string; lines: OrderLine[] } | { problem: string };

function prepareLines(snapshot: CartSnapshot): PreparedLines {
  if (snapshot.items.length === 0) return { problem: 'Your cart is empty.' };
  if (snapshot.shopCount > 1) {
    return {
      problem: 'Your cart has items from more than one shop. Keep items from a single shop to check out.',
    };
  }

  const lines: OrderLine[] = [];
  let businessId = '';
  for (const item of snapshot.items) {
    if (!item.product || getCartItemIssue(item)) {
      return {
        problem: 'Some items in your cart are unavailable or low on stock. Review your cart and try again.',
      };
    }
    businessId = item.product.businessId;
    lines.push({
      productId: item.product.id,
      name: item.product.name,
      unitPrice: item.product.price,
      quantity: item.quantity,
      totalPrice: item.lineTotal,
    });
  }
  return { businessId, shopName: snapshot.shop?.name ?? 'The shop', lines };
}

type CheckoutModalProps = {
  visible: boolean;
  onClose: () => void;
};

// The sheet is mounted only while open, so every checkout starts with fresh fields and a new idempotency key.
export function CheckoutModal({ visible, onClose }: CheckoutModalProps) {
  if (!visible) return null;
  return <CheckoutSheet onClose={onClose} />;
}

function CheckoutSheet({ onClose }: { onClose: () => void }) {
  const isWide = useResponsiveBreakpoint(700);
  const { items, shop, subtotal, itemCount, refresh } = useCart();
  const [initialKey] = useState(createIdempotencyKey);
  const keyRef = useRef(initialKey);
  const attemptRef = useRef<Attempt | null>(null);
  const submittingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('editing');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('delivery');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  // null means "not edited yet", so the saved profile value is shown and can still arrive late.
  const [addressInput, setAddressInput] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [placed, setPlaced] = useState<PlacedSummary | null>(null);

  const address = addressInput ?? profile?.address ?? '';
  const phone = phoneInput ?? profile?.phone ?? '';
  const isDelivery = fulfillment === 'delivery';
  const locked = phase === 'submitting' || phase === 'retry';
  const totals = calculateTotals(subtotal, fulfillment);
  const deliveryOptionFee = getDeliveryCharge(subtotal, 'delivery');

  useEffect(() => {
    let active = true;
    fetchCustomerProfile()
      .then((loaded) => {
        if (active && loaded) setProfile(loaded);
      })
      // The profile is only used to prefill the form and is fetched again when the order is placed.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function close() {
    if (phase !== 'submitting') onClose();
  }

  function showOrders() {
    onClose();
    router.push('/orders');
  }

  function changeFulfillment(next: FulfillmentType) {
    setFulfillment(next);
    setFieldErrors({});
    setSubmitError('');
  }

  function failBeforePlacing(message: string) {
    setSubmitError(message);
    setPhase('editing');
  }

  async function submit() {
    if (submittingRef.current) return;

    if (!attemptRef.current) {
      const errors = validateCheckoutFields({
        fulfillmentType: fulfillment,
        deliveryAddress: address,
        customerPhone: phone,
        customerNotes: notes,
      });
      setFieldErrors(errors);
      if (errors.deliveryAddress || errors.customerPhone) return;
    }

    // Set synchronously so a double tap or a re-render can never start a second placement.
    submittingRef.current = true;
    setPhase('submitting');
    setSubmitError('');

    try {
      let attempt = attemptRef.current;
      if (!attempt) {
        // Re-read the cart so the order is built from current prices and stock.
        const snapshot = await refresh();
        if (!snapshot) {
          failBeforePlacing('We could not check your cart. Check your connection and try again.');
          return;
        }
        const prepared = prepareLines(snapshot);
        if ('problem' in prepared) {
          failBeforePlacing(prepared.problem);
          return;
        }
        const customer = profile ?? (await fetchCustomerProfile());
        if (!customer) {
          failBeforePlacing('We could not find your customer account. Please sign in again.');
          return;
        }

        const orderTotals = calculateTotals(
          roundMoney(prepared.lines.reduce((total, line) => total + line.totalPrice, 0)),
          fulfillment,
        );
        attempt = {
          shopName: prepared.shopName,
          draft: {
            idempotencyKey: keyRef.current,
            customerId: customer.id,
            businessId: prepared.businessId,
            fulfillmentType: fulfillment,
            deliveryAddress: isDelivery ? address.trim() : '',
            customerPhone: phone.trim(),
            customerNotes: notes.trim(),
            lines: prepared.lines,
            ...orderTotals,
          },
        };
        attemptRef.current = attempt;
      }

      const result = await placeOrder(attempt.draft);
      if (result.ok) {
        attemptRef.current = null;
        setPlaced({
          orderNumber: result.order.orderNumber,
          shopName: attempt.shopName,
          fulfillmentType: attempt.draft.fulfillmentType,
          totalAmount: attempt.draft.totalAmount,
          cartCleared: result.cartCleared,
        });
        setPhase('placed');
        void refresh();
        return;
      }

      setSubmitError(result.message);
      if (result.retryable) {
        setPhase('retry');
        return;
      }
      attemptRef.current = null;
      if (result.keyConsumed) keyRef.current = createIdempotencyKey();
      setPhase('editing');
      void refresh();
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Something went wrong while placing your order.'));
      setPhase(attemptRef.current ? 'retry' : 'editing');
    } finally {
      submittingRef.current = false;
    }
  }

  const buttonLabel =
    phase === 'retry' ? 'Try again' : `Place order · ${formatCurrency(totals.totalAmount)}`;

  return (
    <Modal
      animationType={isWide ? 'fade' : 'slide'}
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, isWide && styles.backdropWide]}>
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[styles.sheet, isWide && styles.sheetWide]}>
          {phase === 'placed' && placed ? (
            <PlacedView
              onContinue={() => {
                onClose();
                router.replace('/');
              }}
              onViewOrders={showOrders}
              placed={placed}
            />
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>CHECKOUT</Text>
                  <Text style={styles.title}>Place your order</Text>
                  <Text numberOfLines={1} style={styles.subtitle}>
                    {shop ? `From ${shop.name} · ` : ''}
                    {formatQuantity(itemCount)} {itemCount === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close checkout"
                  accessibilityRole="button"
                  disabled={phase === 'submitting'}
                  onPress={close}
                  style={({ pressed }) => [styles.closeButton, (pressed || phase === 'submitting') && styles.dimmed]}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>How would you like to get your order?</Text>
                <View style={styles.optionRow}>
                  <OptionCard
                    description="Collect it from the shop."
                    disabled={locked}
                    icon="🏪"
                    onPress={() => changeFulfillment('pickup')}
                    selected={fulfillment === 'pickup'}
                    tag="Free"
                    title="Store pickup"
                  />
                  <OptionCard
                    description="Delivered to your address."
                    disabled={locked}
                    icon="🛵"
                    onPress={() => changeFulfillment('delivery')}
                    selected={fulfillment === 'delivery'}
                    tag={deliveryOptionFee > 0 ? formatCurrency(deliveryOptionFee) : 'Free'}
                    title="Home delivery"
                  />
                </View>

                {isDelivery ? (
                  <Field
                    accessibilityLabel="Delivery address"
                    autoComplete="street-address"
                    editable={!locked}
                    error={fieldErrors.deliveryAddress}
                    label="Delivery address *"
                    maxLength={MAX_ADDRESS_LENGTH}
                    multiline
                    onChangeText={(value) => {
                      setAddressInput(value);
                      setFieldErrors((current) => ({ ...current, deliveryAddress: undefined }));
                    }}
                    placeholder="House name / number, street, area, landmark"
                    textContentType="fullStreetAddress"
                    value={address}
                  />
                ) : null}
                <Field
                  accessibilityLabel="Phone number"
                  autoComplete="tel"
                  editable={!locked}
                  error={fieldErrors.customerPhone}
                  keyboardType="phone-pad"
                  label={isDelivery ? 'Phone number *' : 'Phone number (optional)'}
                  maxLength={20}
                  onChangeText={(value) => {
                    setPhoneInput(value);
                    setFieldErrors((current) => ({ ...current, customerPhone: undefined }));
                  }}
                  placeholder="So the shop can reach you"
                  textContentType="telephoneNumber"
                  value={phone}
                />
                <Field
                  accessibilityLabel="Order notes"
                  editable={!locked}
                  label="Notes for the shop (optional)"
                  maxLength={MAX_NOTES_LENGTH}
                  multiline
                  onChangeText={setNotes}
                  placeholder="Anything the shop should know?"
                  value={notes}
                />

                <Text style={styles.sectionTitle}>Payment method</Text>
                <View style={styles.paymentCard}>
                  <View style={styles.paymentIcon}><Text style={styles.paymentIconText}>💵</Text></View>
                  <View style={styles.paymentCopy}>
                    <Text style={styles.paymentTitle}>Cash on Delivery / Pay at Shop</Text>
                    <Text style={styles.paymentNote}>
                      {isDelivery
                        ? 'Pay in cash when your order arrives. No online payment needed.'
                        : 'Pay at the shop when you collect your order. No online payment needed.'}
                    </Text>
                  </View>
                  <View style={styles.codTag}><Text style={styles.codTagText}>COD</Text></View>
                </View>

                <Text style={styles.sectionTitle}>Order summary</Text>
                <View style={styles.summaryCard}>
                  {items.map((item) =>
                    item.product ? (
                      <View key={item.id} style={styles.summaryItem}>
                        <Text numberOfLines={1} style={styles.summaryItemName}>
                          {item.product.name} × {formatQuantity(item.quantity)}
                        </Text>
                        <Text style={styles.summaryItemTotal}>{formatCurrency(item.lineTotal)}</Text>
                      </View>
                    ) : null,
                  )}
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="Items subtotal" value={formatCurrency(totals.subtotal)} />
                  <SummaryRow
                    label={isDelivery ? 'Delivery charge' : 'Store pickup'}
                    value={totals.deliveryCharge > 0 ? formatCurrency(totals.deliveryCharge) : 'Free'}
                  />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total to pay</Text>
                    <Text style={styles.totalValue}>{formatCurrency(totals.totalAmount)}</Text>
                  </View>
                </View>

                {submitError ? (
                  <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorBox}>
                    <Text style={styles.errorText}>{submitError}</Text>
                    {phase === 'retry' ? (
                      <>
                        <Text style={styles.errorHint}>
                          Your order may already have been received. Tap “Try again” and we’ll make sure
                          it is only placed once.
                        </Text>
                        <Pressable accessibilityRole="button" onPress={showOrders} style={styles.linkButton}>
                          <Text style={styles.linkButtonText}>Check my orders instead</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: phase === 'submitting', disabled: phase === 'submitting' }}
                  disabled={phase === 'submitting'}
                  onPress={() => void submit()}
                  style={({ pressed }) => [
                    styles.placeButton,
                    (pressed || phase === 'submitting') && styles.dimmed,
                  ]}>
                  {phase === 'submitting' ? (
                    <View style={styles.placeButtonBusy}>
                      <ActivityIndicator color="#ffffff" size="small" />
                      <Text style={styles.placeButtonText}>Placing your order…</Text>
                    </View>
                  ) : (
                    <Text style={styles.placeButtonText}>{buttonLabel}</Text>
                  )}
                </Pressable>
                <Text style={styles.footerNote}>
                  The shop reviews every order request. You pay only when you receive your order.
                </Text>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PlacedView({
  onContinue,
  onViewOrders,
  placed,
}: {
  onContinue: () => void;
  onViewOrders: () => void;
  placed: PlacedSummary;
}) {
  return (
    <ScrollView contentContainerStyle={styles.placedBody} showsVerticalScrollIndicator={false}>
      <View style={styles.placedIcon}><Text style={styles.placedIconText}>✓</Text></View>
      <Text accessibilityLiveRegion="polite" style={styles.placedTitle}>Order placed!</Text>
      <Text style={styles.placedLabel}>Your order number</Text>
      <Text selectable style={styles.placedNumber}>{placed.orderNumber}</Text>
      <Text style={styles.placedMessage}>
        {placed.shopName} will review your order request shortly. You’ll pay{' '}
        {formatCurrency(placed.totalAmount)} in cash{' '}
        {placed.fulfillmentType === 'delivery' ? 'when it arrives' : 'at the shop when you collect it'}.
      </Text>
      {!placed.cartCleared ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            We couldn’t clear your cart automatically. Remove the ordered items from your cart so you
            don’t order them twice.
          </Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onViewOrders}
        style={({ pressed }) => [styles.placeButton, styles.placedButton, pressed && styles.dimmed]}>
        <Text style={styles.placeButtonText}>View my orders</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onContinue}
        style={({ pressed }) => [styles.secondaryButton, styles.placedButton, pressed && styles.dimmed]}>
        <Text style={styles.secondaryButtonText}>Continue shopping</Text>
      </Pressable>
    </ScrollView>
  );
}

function OptionCard({
  description,
  disabled,
  icon,
  onPress,
  selected,
  tag,
  title,
}: {
  description: string;
  disabled: boolean;
  icon: string;
  onPress: () => void;
  selected: boolean;
  tag: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        selected && styles.optionCardSelected,
        (pressed || (disabled && !selected)) && styles.dimmed,
      ]}>
      <View style={styles.optionTop}>
        <Text style={styles.optionIcon}>{icon}</Text>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
      <Text style={[styles.optionTag, selected && styles.optionTagSelected]}>{tag}</Text>
    </Pressable>
  );
}

function Field({
  error,
  label,
  multiline = false,
  ...props
}: ComponentProps<typeof TextInput> & { error?: string; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#a1aba2"
        style={[
          styles.input,
          multiline && styles.multilineInput,
          props.editable === false && styles.inputLocked,
          error ? styles.inputError : null,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(14, 30, 20, 0.5)',
  },
  backdropWide: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Palette.surface,
    overflow: 'hidden',
  },
  sheetWide: {
    maxWidth: 580,
    maxHeight: '90%',
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1ed',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: Palette.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#18351f',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 11,
    marginTop: 3,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f0',
  },
  closeText: {
    color: '#18351f',
    fontSize: 22,
    lineHeight: 26,
  },
  body: {
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    gap: 3,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#dbe6db',
    borderRadius: 14,
    backgroundColor: '#fbfdfb',
  },
  optionCardSelected: {
    borderColor: Palette.green,
    backgroundColor: '#eef8ec',
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIcon: {
    fontSize: 22,
  },
  radio: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#b9c9bb',
    borderRadius: 9,
    backgroundColor: Palette.surface,
  },
  radioSelected: {
    borderColor: Palette.green,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Palette.green,
  },
  optionTitle: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  optionDescription: {
    color: Palette.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  optionTag: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    backgroundColor: '#eceeed',
    color: '#4b5a4f',
    fontSize: 10,
    fontWeight: '800',
  },
  optionTagSelected: {
    backgroundColor: '#d6efd9',
    color: Palette.darkGreen,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: '#425446',
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d8e4d8',
    borderRadius: 11,
    backgroundColor: '#fcfdfb',
    color: Palette.text,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  multilineInput: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  inputLocked: {
    backgroundColor: '#f1f4f1',
    color: '#6c7a70',
  },
  inputError: {
    borderColor: '#d9776f',
    backgroundColor: '#fff8f7',
  },
  fieldError: {
    color: Palette.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Palette.green,
    borderRadius: 14,
    backgroundColor: '#eef8ec',
  },
  paymentIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#d6efd9',
  },
  paymentIconText: {
    fontSize: 20,
  },
  paymentCopy: {
    flex: 1,
    minWidth: 0,
  },
  paymentTitle: {
    color: Palette.darkGreen,
    fontSize: 13,
    fontWeight: '800',
  },
  paymentNote: {
    color: '#4f6354',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  codTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: Palette.green,
  },
  codTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  summaryCard: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    backgroundColor: '#fbfcfb',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryItemName: {
    flex: 1,
    color: Palette.text,
    fontSize: 12,
  },
  summaryItemTotal: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 2,
    backgroundColor: '#e9eee9',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: Palette.muted,
    fontSize: 12,
  },
  summaryValue: {
    color: '#45554a',
    fontSize: 12,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9eee9',
  },
  totalLabel: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  totalValue: {
    color: Palette.darkGreen,
    fontSize: 18,
    fontWeight: '900',
  },
  errorBox: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Palette.dangerBorder,
    borderRadius: 12,
    backgroundColor: Palette.dangerBackground,
  },
  errorText: {
    color: Palette.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  errorHint: {
    color: Palette.danger,
    fontSize: 11,
    lineHeight: 17,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  linkButtonText: {
    color: Palette.danger,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  footer: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#edf1ed',
    backgroundColor: Palette.surface,
  },
  placeButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: Palette.green,
  },
  placeButtonBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  footerNote: {
    color: '#8a958c',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
  placedBody: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 26,
  },
  placedIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#d6efd9',
  },
  placedIconText: {
    color: Palette.green,
    fontSize: 36,
    fontWeight: '800',
  },
  placedTitle: {
    color: '#18351f',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 16,
  },
  placedLabel: {
    color: Palette.muted,
    fontSize: 11,
    marginTop: 12,
  },
  placedNumber: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: Palette.tint,
    color: Palette.darkGreen,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  placedMessage: {
    maxWidth: 400,
    color: '#4f6354',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 14,
  },
  warningBox: {
    width: '100%',
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0dca8',
    borderRadius: 12,
    backgroundColor: Palette.warningBackground,
  },
  warningText: {
    color: Palette.warning,
    fontSize: 11,
    lineHeight: 17,
  },
  placedButton: {
    width: '100%',
    marginTop: 14,
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#cfdccf',
    borderRadius: 25,
    backgroundColor: Palette.surface,
  },
  secondaryButtonText: {
    color: Palette.darkGreen,
    fontSize: 14,
    fontWeight: '800',
  },
});
