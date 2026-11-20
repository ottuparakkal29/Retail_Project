import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { supabase } from '@/lib/supabase';

export type CartProduct = {
  id: string;
  name: string;
  detail: string;
  price: number;
  image: string | null;
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  error: string;
  addItem: (product: CartProduct) => Promise<boolean>;
  setItemQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  dismissError: () => void;
};

type CartRow = {
  product_id: string;
  quantity: number;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  unit: string;
  image_path: string | null;
};

const CartContext = createContext<CartContextValue | null>(null);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unable to update your cart. Please try again.';
}

function getImageUrl(path: string | null) {
  return path
    ? supabase.storage.from('product-media').getPublicUrl(path).data.publicUrl
    : null;
}

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadCart = useCallback(async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) {
      setProfileId(null);
      setItems([]);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'customer') {
      setProfileId(null);
      setItems([]);
      return;
    }
    setProfileId(profile.id);

    const { data: cartRows, error: cartError } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('user_id', profile.id);
    if (cartError) throw cartError;

    const rows = (cartRows ?? []) as CartRow[];
    if (!rows.length) {
      setItems([]);
      return;
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, unit, image_path')
      .in('id', rows.map((row) => row.product_id))
      .eq('is_active', true);
    if (productsError) throw productsError;

    const productById = new Map(
      ((products ?? []) as ProductRow[]).map((product) => [product.id, product]),
    );
    setItems(
      rows.flatMap((row) => {
        const product = productById.get(row.product_id);
        return product
          ? [{
              product: {
                id: product.id,
                name: product.name,
                detail: product.unit,
                price: Number(product.price),
                image: getImageUrl(product.image_path),
              },
              quantity: row.quantity,
            }]
          : [];
      }),
    );
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void loadCart()
        .then(() => {
          if (active) setError('');
        })
        .catch((loadError: unknown) => {
          if (active) setError(getErrorMessage(loadError));
        });
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) refresh();
      }, 0);
    });
    refresh();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadCart]);

  const addItem = useCallback(async (product: CartProduct) => {
    setError('');
    try {
      const { error: addError } = await supabase.rpc('add_cart_item', {
        p_product_id: product.id,
        p_quantity: 1,
      });
      if (addError) throw addError;
      await loadCart();
      return true;
    } catch (addError) {
      setError(getErrorMessage(addError));
      return false;
    }
  }, [loadCart]);

  const removeItem = useCallback(async (productId: string) => {
    if (!profileId) return;
    setError('');
    const { error: removeError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', profileId)
      .eq('product_id', productId);
    if (removeError) {
      setError(getErrorMessage(removeError));
      return;
    }
    await loadCart().catch((loadError: unknown) => setError(getErrorMessage(loadError)));
  }, [loadCart, profileId]);

  const setItemQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }
    if (!profileId) {
      setError('Sign in with a customer account to manage your cart.');
      return;
    }

    setError('');
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('user_id', profileId)
      .eq('product_id', productId);
    if (updateError) {
      setError(getErrorMessage(updateError));
      return;
    }
    await loadCart().catch((loadError: unknown) => setError(getErrorMessage(loadError)));
  }, [loadCart, profileId, removeItem]);

  const clearCart = useCallback(async () => {
    if (!profileId) {
      setItems([]);
      return;
    }
    setError('');
    const { error: clearError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', profileId);
    if (clearError) {
      setError(getErrorMessage(clearError));
      return;
    }
    setItems([]);
  }, [profileId]);

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );
  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      error,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      dismissError: () => setError(''),
    }),
    [items, itemCount, subtotal, error, addItem, setItemQuantity, removeItem, clearCart],
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
