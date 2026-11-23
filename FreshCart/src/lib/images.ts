import { supabase } from '@/lib/supabase';

const PRODUCT_BUCKET = 'product-images';
const CATEGORY_BUCKET = 'category-images';

export function getProductImageUrl(path: string | null | undefined) {
  return path ? supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

export function getCategoryImageUrl(path: string | null | undefined) {
  return path ? supabase.storage.from(CATEGORY_BUCKET).getPublicUrl(path).data.publicUrl : null;
}
