import { useEffect, useState } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { getProductImageUrl } from '@/lib/images';
import { supabase } from '@/lib/supabase';

export type Shop = {
  id: string;
  business_name: string;
  business_type: string | null;
  district: string | null;
  taluk: string | null;
  village: string | null;
};

export type ShopCategory = {
  id: string;
  name: string;
  image_path: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  unit: string;
  // null when the shop does not track stock for this product.
  stock: number | null;
  imageUrl: string | null;
  categoryId: string;
  businessId: string;
};

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  compare_at_price: number | string | null;
  unit: string;
  stock_quantity: number | string | null;
  image_path: string | null;
  category_id: string;
  business_id: string;
};

export type ShopCatalogState =
  | { status: 'no-shop' }
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; shop: Shop; products: ShopProduct[]; categories: ShopCategory[] };

type LoadedState = Exclude<ShopCatalogState, { status: 'no-shop' } | { status: 'loading' }>;

const INVALID_UUID_CODE = '22P02';

function toNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toShopProduct(row: ProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name,
    price: toNumber(row.price) ?? 0,
    compareAtPrice: toNumber(row.compare_at_price),
    unit: row.unit,
    stock: toNumber(row.stock_quantity),
    imageUrl: getProductImageUrl(row.image_path),
    categoryId: row.category_id,
    businessId: row.business_id,
  };
}

async function loadCatalog(shopId: string): Promise<LoadedState> {
  const { data: shop, error: shopError } = await supabase
    .from('business_profiles')
    .select('id, business_name, business_type, district, taluk, village')
    .eq('id', shopId)
    .eq('approval_status', 'approved')
    .maybeSingle();
  if (shopError) {
    if (shopError.code === INVALID_UUID_CODE) return { status: 'not-found' };
    throw shopError;
  }
  if (!shop) return { status: 'not-found' };

  const { data: productRows, error: productError } = await supabase
    .from('products')
    .select(
      'id, name, price, compare_at_price, unit, stock_quantity, image_path, category_id, business_id',
    )
    .eq('business_id', shop.id)
    .eq('is_active', true)
    .order('name');
  if (productError) throw productError;

  const products = ((productRows ?? []) as ProductRow[]).map(toShopProduct);
  const categoryIds = Array.from(new Set(products.map((product) => product.categoryId)));
  let categories: ShopCategory[] = [];
  if (categoryIds.length) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, image_path')
      .eq('is_active', true)
      .in('id', categoryIds)
      .order('name');
    if (categoryError) throw categoryError;
    categories = (categoryRows ?? []) as ShopCategory[];
  }

  return { status: 'ready', shop: shop as Shop, products, categories };
}

export function useShopCatalog(shopId: string | undefined) {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<{ key: string; state: LoadedState } | null>(null);
  const key = `${shopId ?? ''}:${reloadCount}`;

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    loadCatalog(shopId)
      .then((state) => {
        if (active) setResult({ key, state });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({
          key,
          state: {
            status: 'error',
            message: getErrorMessage(error, 'Unable to load this shop. Please try again.'),
          },
        });
      });

    return () => {
      active = false;
    };
  }, [shopId, key]);

  let state: ShopCatalogState = { status: 'loading' };
  if (!shopId) state = { status: 'no-shop' };
  else if (result?.key === key) state = result.state;

  return { state, reload: () => setReloadCount((count) => count + 1) };
}
