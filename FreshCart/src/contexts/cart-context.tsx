import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { getErrorDetails, getErrorMessage } from '@/lib/errors';
import { formatQuantity, roundMoney } from '@/lib/format';
import { getProductImageUrl } from '@/lib/images';
import { supabase } from '@/lib/supabase';

export type CartProduct = {
  id: string;
  name: string;
  unit: string;
  price: number;
  // products.stock_quantity; null when the shop does not track stock.
  stock: number | null;
  image: string | null;
  businessId: string;
};

export type CartShop = {
  id: string;
  name: string;
  type: string | null;
  location: string;
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  // null once the product was deactivated or removed after being added to the cart.
  product: CartProduct | null;
  lineTotal: number;
};

export type CartStatus = 'loading' | 'ready' | 'error';
export type CartAccess = 'checking' | 'signed-out' | 'customer' | 'restricted';
// 'busy' means an identical request is already running and this call was ignored.
export type CartActionResult = 'ok' | 'shop-conflict' | 'busy' | 'failed';
export type CartItemIssue = 'unavailable' | 'out-of-stock' | 'limited-stock';

export type CartSnapshot = {
  items: CartItem[];
  shop: CartShop | null;
  shopCount: number;
};

type CartContextValue = {
  status: CartStatus;
  access: CartAccess;
  items: CartItem[];
  shop: CartShop | null;
  hasMultipleShops: boolean;
  itemCount: number;
  subtotal: number;
  loadError: string;
  error: string;
  getQuantity: (productId: string) => number;
  isPending: (productId: string) => boolean;
  isBusy: boolean;
  refresh: () => Promise<CartSnapshot | null>;
  addItem: (product: CartProduct, options?: { replaceCart?: boolean }) => Promise<CartActionResult>;
  setItemQuantity: (productId: string, quantity: number) => Promise<CartActionResult>;
  removeItem: (productId: string) => Promise<CartActionResult>;
  clearCart: () => Promise<CartActionResult>;
  dismissError: () => void;
};

type BusinessRow = {
  id: string;
  business_name: string;
  business_type: string | null;
  district: string | null;
  taluk: string | null;
  village: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  unit: string;
  stock_quantity: number | string | null;
  image_path: string | null;
  business_id: string;
  is_active: boolean;
  business_profiles: BusinessRow | BusinessRow[] | null;
};

type CartRow = {
  id: string;
  product_id: string;
  quantity: number | string;
  products: ProductRow | ProductRow[] | null;
};

const CART_SELECT = `
  id,
  product_id,
  quantity,
  products (
    id, name, price, unit, stock_quantity, image_path, business_id, is_active,
    business_profiles ( id, business_name, business_type, district, taluk, village )
  )
`;

// RAISE ... USING DETAIL from public.add_cart_item (see the cart hardening migration).
const SHOP_CONFLICT_DETAIL = 'CART_SHOP_CONFLICT';
// Lock key for operations that touch the whole cart (clear / replace).
const ALL_KEY = '*';

const EMPTY_SNAPSHOT: CartSnapshot = { items: [], shop: null, shopCount: 0 };
const EMPTY_KEYS: ReadonlySet<string> = new Set();

const CartContext = createContext<CartContextValue | null>(null);

export function getCartItemIssue(item: CartItem): CartItemIssue | null {
  if (!item.product) return 'unavailable';
  const { stock } = item.product;
  if (stock === null) return null;
  if (stock <= 0) return 'out-of-stock';
  return item.quantity > stock ? 'limited-stock' : null;
}

export function canIncreaseQuantity(product: CartProduct, quantity: number) {
  return product.stock === null || quantity + 1 <= product.stock;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCartShop(row: BusinessRow): CartShop {
  return {
    id: row.id,
    name: row.business_name,
    type: row.business_type,
    location: [row.village, row.taluk, row.district].filter(Boolean).join(', '),
  };
}

function toSnapshot(rows: CartRow[]): CartSnapshot {
  let shop: CartShop | null = null;
  const businessIds = new Set<string>();

  const items = rows.map((row): CartItem => {
    const quantity = toNumber(row.quantity) ?? 0;
    const productRow = firstOf(row.products);
    if (!productRow || productRow.is_active === false) {
      return { id: row.id, productId: row.product_id, quantity, product: null, lineTotal: 0 };
    }

    const businessProfile = firstOf(productRow.business_profiles);
    if (businessProfile && !shop) shop = toCartShop(businessProfile);
    businessIds.add(productRow.business_id);

    const product: CartProduct = {
      id: productRow.id,
      name: productRow.name,
      unit: productRow.unit,
      price: toNumber(productRow.price) ?? 0,
      stock: toNumber(productRow.stock_quantity),
      image: getProductImageUrl(productRow.image_path),
      businessId: productRow.business_id,
    };
    return {
      id: row.id,
      productId: row.product_id,
      quantity,
      product,
      lineTotal: roundMoney(product.price * quantity),
    };
  });

  return { items, shop, shopCount: businessIds.size };
}

function accessMessage(access: CartAccess) {
  if (access === 'restricted') return 'Only customer accounts can use the cart.';
  if (access === 'checking') return 'Checking your account. Please try again in a moment.';
  return 'Sign in with a customer account to use your cart.';
}

function stockErrorFor(product: CartProduct, nextQuantity: number) {
  if (product.stock === null || nextQuantity <= product.stock) return '';
  if (product.stock <= 0) return `${product.name} is out of stock.`;
  return `Only ${formatQuantity(product.stock)} of ${product.name} left in stock.`;
}

export function CartProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<CartStatus>('loading');
  const [access, setAccess] = useState<CartAccess>('checking');
  const [snapshot, setSnapshot] = useState<CartSnapshot>(EMPTY_SNAPSHOT);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS);

  const profileIdRef = useRef<string | null>(null);
  const accessRef = useRef<CartAccess>('checking');
  const snapshotRef = useRef<CartSnapshot>(EMPTY_SNAPSHOT);
  const loadedUserRef = useRef<string | null | undefined>(undefined);
  const readyRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const locksRef = useRef(new Set<string>());

  const commit = useCallback((next: CartSnapshot, nextAccess: CartAccess, profileId: string | null) => {
    snapshotRef.current = next;
    accessRef.current = nextAccess;
    profileIdRef.current = profileId;
    setSnapshot(next);
    setAccess(nextAccess);
  }, []);

  // Loads the signed-in customer's cart. Only the most recently started load may update state,
  // so a slow earlier response can never overwrite newer data.
  const refresh = useCallback(async (): Promise<CartSnapshot | null> => {
    const sequence = ++loadSequenceRef.current;
    const isCurrent = () => sequence === loadSequenceRef.current;
    setStatus((current) => (current === 'error' ? 'loading' : current));

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!isCurrent()) return null;

      const user = sessionData.session?.user ?? null;
      const userId = user?.id ?? null;
      if (loadedUserRef.current !== userId) {
        loadedUserRef.current = userId;
        readyRef.current = false;
        setStatus('loading');
      }

      let next = EMPTY_SNAPSHOT;
      if (!user) {
        commit(EMPTY_SNAPSHOT, 'signed-out', null);
      } else {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!isCurrent()) return null;

        if (!profile || profile.role !== 'customer') {
          commit(EMPTY_SNAPSHOT, 'restricted', null);
        } else {
          const { data: rows, error: cartError } = await supabase
            .from('cart_items')
            .select(CART_SELECT)
            .eq('user_id', profile.id)
            .order('created_at', { ascending: true });
          if (cartError) throw cartError;
          if (!isCurrent()) return null;

          next = toSnapshot((rows ?? []) as unknown as CartRow[]);
          commit(next, 'customer', profile.id);
        }
      }

      readyRef.current = true;
      setLoadError('');
      setStatus('ready');
      return next;
    } catch (refreshError) {
      if (!isCurrent()) return null;
      const message = getErrorMessage(refreshError, 'Unable to load your cart. Please try again.');
      if (readyRef.current) {
        setError(message);
      } else {
        setLoadError(message);
        setStatus('error');
      }
      return null;
    }
  }, [commit]);

  useEffect(() => {
    let active = true;
    void refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      // Supabase calls made synchronously inside this callback can deadlock the auth client.
      setTimeout(() => {
        if (active) void refresh();
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  // Rejects overlapping requests: one per product, and exclusive access for whole-cart operations.
  const runLocked = useCallback(
    async (key: string, task: () => Promise<CartActionResult>): Promise<CartActionResult> => {
      const locks = locksRef.current;
      const blocked = key === ALL_KEY ? locks.size > 0 : locks.has(ALL_KEY) || locks.has(key);
      if (blocked) return 'busy';

      locks.add(key);
      setPendingKeys(new Set(locks));
      try {
        return await task();
      } finally {
        locks.delete(key);
        setPendingKeys(new Set(locks));
      }
    },
    [],
  );

  const addItem = useCallback(
    (product: CartProduct, options: { replaceCart?: boolean } = {}) => {
      const replaceCart = options.replaceCart === true;
      return runLocked(replaceCart ? ALL_KEY : product.id, async () => {
        const profileId = profileIdRef.current;
        if (!profileId) {
          setError(accessMessage(accessRef.current));
          return 'failed';
        }
        setError('');

        const currentItems = snapshotRef.current.items;
        const inCart = replaceCart
          ? 0
          : (currentItems.find((item) => item.productId === product.id)?.quantity ?? 0);
        const hasOtherShop = currentItems.some(
          (item) => item.product !== null && item.product.businessId !== product.businessId,
        );
        if (!replaceCart && hasOtherShop) return 'shop-conflict';

        const stockError = stockErrorFor(product, inCart + 1);
        if (stockError) {
          setError(stockError);
          return 'failed';
        }

        try {
          if (replaceCart) {
            const { error: clearError } = await supabase
              .from('cart_items')
              .delete()
              .eq('user_id', profileId);
            if (clearError) throw clearError;
          }

          const { error: addError } = await supabase.rpc('add_cart_item', {
            p_product_id: product.id,
            p_quantity: 1,
          });
          if (addError) {
            // The server found items from another shop that this tab did not know about yet.
            if (getErrorDetails(addError) === SHOP_CONFLICT_DETAIL) {
              await refresh();
              return 'shop-conflict';
            }
            throw addError;
          }

          await refresh();
          return 'ok';
        } catch (addError) {
          setError(getErrorMessage(addError, 'Unable to add this item to your cart.'));
          await refresh();
          return 'failed';
        }
      });
    },
    [refresh, runLocked],
  );

  const setItemQuantity = useCallback(
    (productId: string, quantity: number) =>
      runLocked(productId, async () => {
        const profileId = profileIdRef.current;
        if (!profileId) {
          setError(accessMessage(accessRef.current));
          return 'failed';
        }
        setError('');

        try {
          if (quantity <= 0) {
            const { error: deleteError } = await supabase
              .from('cart_items')
              .delete()
              .eq('user_id', profileId)
              .eq('product_id', productId);
            if (deleteError) throw deleteError;
          } else {
            const product = snapshotRef.current.items.find(
              (item) => item.productId === productId,
            )?.product;
            const stockError = product ? stockErrorFor(product, quantity) : '';
            if (stockError) {
              setError(stockError);
              return 'failed';
            }

            // updated_at is stamped by the cart_items_set_updated_at trigger; clients may only write quantity.
            const { data: updated, error: updateError } = await supabase
              .from('cart_items')
              .update({ quantity })
              .eq('user_id', profileId)
              .eq('product_id', productId)
              .select('id');
            if (updateError) throw updateError;
            if (!updated?.length) throw new Error('This item is no longer in your cart.');
          }

          await refresh();
          return 'ok';
        } catch (updateError) {
          setError(getErrorMessage(updateError, 'Unable to update your cart. Please try again.'));
          await refresh();
          return 'failed';
        }
      }),
    [refresh, runLocked],
  );

  const removeItem = useCallback(
    (productId: string) => setItemQuantity(productId, 0),
    [setItemQuantity],
  );

  const clearCart = useCallback(
    () =>
      runLocked(ALL_KEY, async () => {
        const profileId = profileIdRef.current;
        if (!profileId) {
          setError(accessMessage(accessRef.current));
          return 'failed';
        }
        setError('');

        try {
          const { error: clearError } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', profileId);
          if (clearError) throw clearError;
          await refresh();
          return 'ok';
        } catch (clearError) {
          setError(getErrorMessage(clearError, 'Unable to clear your cart. Please try again.'));
          await refresh();
          return 'failed';
        }
      }),
    [refresh, runLocked],
  );

  const dismissError = useCallback(() => setError(''), []);

  const { items, shop, shopCount } = snapshot;
  const quantityByProduct = useMemo(
    () => new Map(items.map((item) => [item.productId, item.quantity])),
    [items],
  );
  const getQuantity = useCallback(
    (productId: string) => quantityByProduct.get(productId) ?? 0,
    [quantityByProduct],
  );
  const isPending = useCallback(
    (productId: string) => pendingKeys.has(productId) || pendingKeys.has(ALL_KEY),
    [pendingKeys],
  );
  const itemCount = useMemo(
    () =>
      Number(
        items.reduce((total, item) => (item.product ? total + item.quantity : total), 0).toFixed(3),
      ),
    [items],
  );
  const subtotal = useMemo(
    () => roundMoney(items.reduce((total, item) => total + item.lineTotal, 0)),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      status,
      access,
      items,
      shop,
      hasMultipleShops: shopCount > 1,
      itemCount,
      subtotal,
      loadError,
      error,
      getQuantity,
      isPending,
      isBusy: pendingKeys.size > 0,
      refresh,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      dismissError,
    }),
    [
      status,
      access,
      items,
      shop,
      shopCount,
      itemCount,
      subtotal,
      loadError,
      error,
      getQuantity,
      isPending,
      pendingKeys,
      refresh,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      dismissError,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider.');
  }
  return context;
}
