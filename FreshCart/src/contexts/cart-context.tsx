import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { products, type Product } from '@/constants/products';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product) => void;
  setItemQuantity: (productName: string, quantity: number) => void;
  removeItem: (productName: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: PropsWithChildren) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const items = useMemo(
    () =>
      products.flatMap((product) => {
        const quantity = quantities[product.name] ?? 0;
        return quantity > 0 ? [{ product, quantity }] : [];
      }),
    [quantities],
  );
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  function addItem(product: Product) {
    setQuantities((current) => ({
      ...current,
      [product.name]: (current[product.name] ?? 0) + 1,
    }));
  }

  function setItemQuantity(productName: string, quantity: number) {
    setQuantities((current) => {
      if (quantity <= 0) {
        const { [productName]: removed, ...remaining } = current;
        void removed;
        return remaining;
      }
      return { ...current, [productName]: quantity };
    });
  }

  function removeItem(productName: string) {
    setItemQuantity(productName, 0);
  }

  function clearCart() {
    setQuantities({});
  }

  const value = useMemo(
    () => ({ items, itemCount, subtotal, addItem, setItemQuantity, removeItem, clearCart }),
    [items, itemCount, subtotal],
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
