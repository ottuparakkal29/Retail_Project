import { getErrorDetails, getErrorMessage } from '@/lib/errors';
import { roundMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type FulfillmentType = 'pickup' | 'delivery';
export type PaymentStatus = 'unpaid' | 'paid';

export type OrderFeedback = { tone: 'success' | 'error'; text: string };

export type OrderItem = {
  id: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  businessId: string;
  shopName: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  deliveryAddress: string;
  customerPhone: string;
  customerNotes: string;
  rejectionReason: string;
  createdAt: string;
  items: OrderItem[];
};

export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_CHARGE = 40;
export const MAX_ADDRESS_LENGTH = 300;
export const MAX_NOTES_LENGTH = 300;
export const MAX_REJECTION_REASON_LENGTH = 200;

// RAISE ... USING DETAIL from the order_items trigger (see the order management migration).
const PRICE_CHANGED_DETAIL = 'ORDER_PRICE_CHANGED';
const ITEM_UNAVAILABLE_DETAIL = 'ORDER_ITEM_UNAVAILABLE';
const UNIQUE_VIOLATION = '23505';
const INSUFFICIENT_PRIVILEGE = '42501';

export type StatusTone = 'warning' | 'info' | 'progress' | 'success' | 'danger' | 'neutral';

const STATUS_META: Record<OrderStatus, { label: string; tone: StatusTone; customerNote: string }> = {
  pending: {
    label: 'Pending',
    tone: 'warning',
    customerNote: 'Waiting for the shop to accept your order.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'info',
    customerNote: 'The shop accepted your order and will start preparing it soon.',
  },
  preparing: {
    label: 'Preparing',
    tone: 'progress',
    customerNote: 'The shop is getting your order ready.',
  },
  ready_for_pickup: {
    label: 'Ready for pickup',
    tone: 'success',
    customerNote: 'Your order is ready. Collect it from the shop and pay there.',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    tone: 'success',
    customerNote: 'Your order is on its way. Keep the cash ready.',
  },
  delivered: {
    label: 'Delivered',
    tone: 'success',
    customerNote: 'Order completed. Thanks for shopping with FreshCart!',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    customerNote: 'The shop could not take this order.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
    customerNote: 'This order was cancelled.',
  },
};

export function getStatusMeta(status: string) {
  return (
    STATUS_META[status as OrderStatus] ?? { label: status, tone: 'neutral' as const, customerNote: '' }
  );
}

export function getFulfillmentLabel(type: FulfillmentType) {
  return type === 'pickup' ? 'Store pickup' : 'Home delivery';
}

export function getPaymentLabel(method: string) {
  return method === 'cod' ? 'Cash on Delivery / Pay at Shop' : method;
}

export function getDeliveryCharge(subtotal: number, fulfillmentType: FulfillmentType) {
  if (fulfillmentType === 'pickup' || subtotal <= 0 || subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return DELIVERY_CHARGE;
}

export function calculateTotals(subtotal: number, fulfillmentType: FulfillmentType) {
  const roundedSubtotal = roundMoney(subtotal);
  const deliveryCharge = getDeliveryCharge(roundedSubtotal, fulfillmentType);
  return {
    subtotal: roundedSubtotal,
    deliveryCharge,
    totalAmount: roundMoney(roundedSubtotal + deliveryCharge),
  };
}

export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export type CheckoutFields = {
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  customerPhone: string;
  customerNotes: string;
};

export type CheckoutFieldErrors = { deliveryAddress?: string; customerPhone?: string };

export function validateCheckoutFields(fields: CheckoutFields): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const phone = fields.customerPhone.trim();
  const isDelivery = fields.fulfillmentType === 'delivery';

  if (isDelivery && fields.deliveryAddress.trim().length < 5) {
    errors.deliveryAddress = 'Enter the full address where we should deliver your order.';
  }
  if (isDelivery && !phone) {
    errors.customerPhone = 'Enter a phone number so the shop can reach you.';
  } else if (phone && !isValidPhone(phone)) {
    errors.customerPhone = 'Enter a valid phone number (7 to 15 digits).';
  }
  return errors;
}

// randomUUID is missing in React Native and in non-secure web contexts, so fall back to a v4 UUID.
export function createIdempotencyKey() {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type PostgrestLikeError = { message?: unknown; code?: unknown; details?: unknown };

function readCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as PostgrestLikeError;
    if (typeof code === 'string') return code;
  }
  return '';
}

// Missing row level security policies are the usual cause of a permission error while setting up.
export function getOrderErrorMessage(error: unknown, fallback: string) {
  const details = getErrorDetails(error);
  if (details === PRICE_CHANGED_DETAIL) {
    return 'Some prices changed while you were checking out. Please review your cart and try again.';
  }
  if (details === ITEM_UNAVAILABLE_DETAIL) {
    return 'An item in your cart is no longer available. Please review your cart and try again.';
  }
  if (readCode(error) === INSUFFICIENT_PRIVILEGE) {
    const message = 'The database refused this request. Please try again later or contact support.';
    return __DEV__
      ? `${message} (${getErrorMessage(error, 'permission denied')}) Developers: run supabase/migrations/20261123000000_order_management_access.sql in the Supabase SQL Editor.`
      : message;
  }
  return getErrorMessage(error, fallback);
}

// status 0 is a network failure; a gateway error or timeout may also have reached the database.
function isIndeterminate(status: number) {
  return status === 0 || status === 408 || status >= 500;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number | string;
  quantity: number | string;
  total_price: number | string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  business_id: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  payment_method: string;
  payment_status: PaymentStatus;
  subtotal: number | string;
  delivery_charge: number | string;
  total_amount: number | string;
  delivery_address: string | null;
  customer_phone: string | null;
  customer_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  business_profiles?: { id: string; business_name: string } | { id: string; business_name: string }[] | null;
  order_items?: OrderItemRow[] | null;
};

const ORDER_COLUMNS =
  'id, order_number, customer_id, business_id, status, fulfillment_type, payment_method, payment_status, subtotal, delivery_charge, total_amount, delivery_address, customer_phone, customer_notes, rejection_reason, created_at';
const ITEM_COLUMNS = 'id, product_id, product_name, unit_price, quantity, total_price';
const CUSTOMER_ORDER_SELECT = `${ORDER_COLUMNS}, business_profiles ( id, business_name ), order_items ( ${ITEM_COLUMNS} )`;
const BUSINESS_ORDER_SELECT = `${ORDER_COLUMNS}, order_items ( ${ITEM_COLUMNS} )`;

function toOrder(row: OrderRow): Order {
  const shop = firstOf(row.business_profiles);
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    businessId: row.business_id,
    shopName: shop?.business_name ?? 'Shop',
    status: row.status,
    fulfillmentType: row.fulfillment_type,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    subtotal: toNumber(row.subtotal),
    deliveryCharge: toNumber(row.delivery_charge),
    totalAmount: toNumber(row.total_amount),
    deliveryAddress: row.delivery_address?.trim() ?? '',
    customerPhone: row.customer_phone?.trim() ?? '',
    customerNotes: row.customer_notes?.trim() ?? '',
    rejectionReason: row.rejection_reason?.trim() ?? '',
    createdAt: row.created_at,
    items: (row.order_items ?? [])
      .map(
        (item): OrderItem => ({
          id: item.id,
          productId: item.product_id,
          name: item.product_name,
          unitPrice: toNumber(item.unit_price),
          quantity: toNumber(item.quantity),
          totalPrice: toNumber(item.total_price),
        }),
      )
      .sort((first, second) => first.name.localeCompare(second.name)),
  };
}

export type CustomerProfile = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
};

// Resolves the signed-in user's profiles row; its id is what cart_items.user_id and orders.customer_id reference.
export async function fetchCustomerProfile(): Promise<CustomerProfile | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, address')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name ?? '',
    phone: data.phone ?? '',
    address: data.address ?? '',
  };
}

export type BusinessContext =
  | { kind: 'signed-out' }
  | { kind: 'not-business' }
  | { kind: 'not-approved' }
  | { kind: 'ready'; businessId: string; businessName: string };

export async function fetchBusinessContext(): Promise<BusinessContext> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return { kind: 'signed-out' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== 'business') return { kind: 'not-business' };

  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .select('id, business_name, approval_status')
    .eq('user_id', profile.id)
    .maybeSingle();
  if (businessError) throw businessError;
  if (!business || business.approval_status !== 'approved') return { kind: 'not-approved' };
  return { kind: 'ready', businessId: business.id, businessName: business.business_name };
}

export async function fetchCustomerOrders(customerId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(CUSTOMER_ORDER_SELECT)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
}

export async function fetchBusinessOrders(businessId: string, limit = 200): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(BUSINESS_ORDER_SELECT)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
}

// Resolves 'not-pending' when the shop already acted on the order, so the customer cannot cancel it any more.
export async function cancelPendingOrder(orderId: string): Promise<'cancelled' | 'not-pending'> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  return data && data.length > 0 ? 'cancelled' : 'not-pending';
}

export type BusinessActionKey =
  | 'accept'
  | 'reject'
  | 'start-preparing'
  | 'ready-for-pickup'
  | 'out-for-delivery'
  | 'mark-delivered';

export type BusinessAction = {
  key: BusinessActionKey;
  label: string;
  from: OrderStatus;
  to: OrderStatus;
  destructive?: boolean;
  needsReason?: boolean;
  marksPaid?: boolean;
};

export function getBusinessActions(order: Pick<Order, 'status' | 'fulfillmentType'>): BusinessAction[] {
  switch (order.status) {
    case 'pending':
      return [
        { key: 'accept', label: 'Accept order', from: 'pending', to: 'accepted' },
        {
          key: 'reject',
          label: 'Reject order',
          from: 'pending',
          to: 'rejected',
          destructive: true,
          needsReason: true,
        },
      ];
    case 'accepted':
      return [{ key: 'start-preparing', label: 'Start preparing', from: 'accepted', to: 'preparing' }];
    case 'preparing':
      return order.fulfillmentType === 'pickup'
        ? [{ key: 'ready-for-pickup', label: 'Ready for pickup', from: 'preparing', to: 'ready_for_pickup' }]
        : [{ key: 'out-for-delivery', label: 'Out for delivery', from: 'preparing', to: 'out_for_delivery' }];
    case 'ready_for_pickup':
    case 'out_for_delivery':
      return [
        {
          key: 'mark-delivered',
          label: 'Mark delivered & paid',
          from: order.status,
          to: 'delivered',
          marksPaid: true,
        },
      ];
    default:
      return [];
  }
}

export type BusinessOrderTab = 'new' | 'active' | 'closed';

export const BUSINESS_TAB_STATUSES: Record<BusinessOrderTab, readonly OrderStatus[]> = {
  new: ['pending'],
  active: ['accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'],
  closed: ['delivered', 'rejected', 'cancelled'],
};

export function getBusinessTab(status: OrderStatus): BusinessOrderTab {
  if (BUSINESS_TAB_STATUSES.new.includes(status)) return 'new';
  if (BUSINESS_TAB_STATUSES.active.includes(status)) return 'active';
  return 'closed';
}

export type BusinessActionResult =
  | { ok: true; status: OrderStatus; paymentStatus: PaymentStatus; rejectionReason: string }
  | { ok: false; stale: boolean; message: string };

// The status filter makes the change conditional, so it cannot overwrite a concurrent cancel or update.
export async function applyBusinessAction(
  order: Pick<Order, 'id' | 'businessId'>,
  action: BusinessAction,
  rejectionReason = '',
): Promise<BusinessActionResult> {
  const patch: { status: OrderStatus; payment_status?: PaymentStatus; rejection_reason?: string } = {
    status: action.to,
  };
  if (action.marksPaid) patch.payment_status = 'paid';
  if (action.needsReason) patch.rejection_reason = rejectionReason.trim();

  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', order.id)
    .eq('business_id', order.businessId)
    .eq('status', action.from)
    .select('status, payment_status, rejection_reason');
  if (error) {
    return { ok: false, stale: false, message: getOrderErrorMessage(error, 'Unable to update this order. Please try again.') };
  }

  const updated = data?.[0] as
    | { status: OrderStatus; payment_status: PaymentStatus; rejection_reason: string | null }
    | undefined;
  if (!updated) {
    return {
      ok: false,
      stale: true,
      message: 'This order was just updated by someone else (for example, the customer cancelled it).',
    };
  }
  return {
    ok: true,
    status: updated.status,
    paymentStatus: updated.payment_status,
    rejectionReason: updated.rejection_reason?.trim() ?? '',
  };
}

export type OrderLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

export type OrderDraft = CheckoutFields & {
  idempotencyKey: string;
  customerId: string;
  businessId: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
};

export type PlacedOrder = { id: string; orderNumber: string };

export type PlaceOrderResult =
  | { ok: true; order: PlacedOrder; cartCleared: boolean }
  | {
      ok: false;
      message: string;
      // The outcome is unknown (network or server failure): retry with the same draft so no duplicate is created.
      retryable: boolean;
      // An order row now exists for this idempotency key, so a new attempt needs a new key.
      keyConsumed: boolean;
    };

type StepFailure = { ok: false; message: string; retryable: boolean };

function stepFailure(error: unknown, status: number, fallback: string): StepFailure {
  return { ok: false, message: getOrderErrorMessage(error, fallback), retryable: isIndeterminate(status) };
}

function toOrderInsert(draft: OrderDraft) {
  const phone = draft.customerPhone.trim();
  const notes = draft.customerNotes.trim();
  const address = draft.deliveryAddress.trim();
  // Optional columns are omitted rather than sent as null so the table defaults apply.
  return {
    customer_id: draft.customerId,
    business_id: draft.businessId,
    status: 'pending',
    fulfillment_type: draft.fulfillmentType,
    payment_method: 'cod',
    payment_status: 'unpaid',
    subtotal: draft.subtotal,
    delivery_charge: draft.deliveryCharge,
    total_amount: draft.totalAmount,
    idempotency_key: draft.idempotencyKey,
    ...(draft.fulfillmentType === 'delivery' && address ? { delivery_address: address } : {}),
    ...(phone ? { customer_phone: phone } : {}),
    ...(notes ? { customer_notes: notes } : {}),
  };
}

// Step 1. A repeated idempotency key means an earlier attempt already created the order, so reuse it.
async function createOrderRow(
  draft: OrderDraft,
): Promise<{ ok: true; order: PlacedOrder; resumed: boolean } | StepFailure> {
  const { data, error, status } = await supabase
    .from('orders')
    .insert(toOrderInsert(draft))
    .select('id, order_number')
    .single();
  if (!error && data) {
    return { ok: true, order: { id: data.id, orderNumber: data.order_number }, resumed: false };
  }

  if (error && readCode(error) === UNIQUE_VIOLATION) {
    const existing = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('idempotency_key', draft.idempotencyKey)
      .eq('customer_id', draft.customerId)
      .maybeSingle();
    if (existing.error) {
      return stepFailure(existing.error, existing.status, 'We could not confirm your order. Please try again.');
    }
    if (existing.data) {
      return {
        ok: true,
        order: { id: existing.data.id, orderNumber: existing.data.order_number },
        resumed: true,
      };
    }
  }

  return stepFailure(error, status, 'We could not place your order. Please try again.');
}

// Step 2. The snapshot is inserted in one statement, so an order has either all of its items or none.
async function saveOrderItems(
  orderId: string,
  lines: OrderLine[],
  resumed: boolean,
): Promise<{ ok: true } | StepFailure> {
  if (resumed) {
    const { count, error, status } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);
    if (error) return stepFailure(error, status, 'We could not confirm your order items. Please try again.');
    if ((count ?? 0) > 0) return { ok: true };
  }

  const { error, status } = await supabase.from('order_items').insert(
    lines.map((line) => ({
      order_id: orderId,
      product_id: line.productId,
      product_name: line.name,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      total_price: line.totalPrice,
    })),
  );
  if (error) return stepFailure(error, status, 'We could not save your order items. Please try again.');
  return { ok: true };
}

// Cancels an order whose items could not be saved so the shop never sees an empty request.
async function abandonOrder(orderId: string) {
  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending');
}

// Step 3. Only the ordered products are removed, so items added in another tab are kept.
async function clearOrderedCartItems(customerId: string, lines: OrderLine[]) {
  const productIds = lines.map((line) => line.productId);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', customerId)
      .in('product_id', productIds);
    if (!error) return true;
  }
  return false;
}

// Safe to call again with the same draft after a retryable failure: every step is idempotent.
export async function placeOrder(draft: OrderDraft): Promise<PlaceOrderResult> {
  const created = await createOrderRow(draft);
  if (!created.ok) {
    return { ok: false, message: created.message, retryable: created.retryable, keyConsumed: false };
  }

  const saved = await saveOrderItems(created.order.id, draft.lines, created.resumed);
  if (!saved.ok) {
    if (!saved.retryable) await abandonOrder(created.order.id);
    return { ok: false, message: saved.message, retryable: saved.retryable, keyConsumed: true };
  }

  const cartCleared = await clearOrderedCartItems(draft.customerId, draft.lines);
  return { ok: true, order: created.order, cartCleared };
}

let channelCounter = 0;

// Calls onChange (debounced) whenever an order matching the filter is inserted or updated.
export function subscribeToOrderChanges(filter: string, onChange: () => void, debounceMs = 800) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  channelCounter += 1;
  const channel = supabase
    .channel(`orders-feed-${channelCounter}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, debounceMs);
    })
    .subscribe();

  return () => {
    clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
