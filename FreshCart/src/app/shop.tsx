import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { useCart, type CartProduct } from '@/contexts/cart-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

type Shop = {
  id: string;
  business_name: string;
  business_type: string | null;
  district: string | null;
  taluk: string | null;
  village: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  stock_quantity: number;
  image_path: string | null;
  category_id: string;
};

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unable to load this shop. Please try again.';
}

function imageUrl(path: string | null) {
  return path
    ? supabase.storage.from('product-media').getPublicUrl(path).data.publicUrl
    : null;
}

export default function ShopStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWide = useResponsiveBreakpoint(850);
  const { addItem, error: cartError, dismissError } = useCart();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addedProductId, setAddedProductId] = useState('');

  useEffect(() => {
    let active = true;
    async function loadShop() {
      if (!id) {
        setLoadError('Shop not found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');
      const { data: shopData, error: shopError } = await supabase
        .from('business_profiles')
        .select(
          'id, business_name, business_type, district, taluk, village, address, contact_name, contact_email, contact_phone',
        )
        .eq('id', id)
        .eq('approval_status', 'approved')
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shopData) {
        if (active) {
          setShop(null);
          setProducts([]);
          setCategories([]);
        }
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, description, price, unit, stock_quantity, image_path, category_id')
        .eq('business_id', shopData.id)
        .eq('is_active', true)
        .order('name');
      if (productError) throw productError;

      const productRows = (productData ?? []) as Product[];
      const categoryIds = Array.from(new Set(productRows.map((product) => product.category_id)));
      const { data: categoryData, error: categoryError } = categoryIds.length
        ? await supabase
            .from('categories')
            .select('id, name')
            .eq('is_active', true)
            .in('id', categoryIds)
            .order('name')
        : { data: [], error: null };
      if (categoryError) throw categoryError;
      if (!active) return;

      setShop(shopData as Shop);
      setProducts(productRows);
      setCategories((categoryData ?? []) as Category[]);
    }

    void loadShop()
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          selectedCategory === 'all' || product.category_id === selectedCategory,
      ),
    [products, selectedCategory],
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  async function addProductToCart(product: Product) {
    dismissError();
    const image = imageUrl(product.image_path);
    const cartProduct: CartProduct = {
      id: product.id,
      name: product.name,
      detail: product.unit,
      price: Number(product.price),
      image,
    };
    if (await addItem(cartProduct)) {
      setAddedProductId(product.id);
      setTimeout(() => setAddedProductId((current) =>
        current === product.id ? '' : current,
      ), 1800);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={styles.topbar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backText}>‹</Text>
              <Text style={styles.backLabel}>Back to shops</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/cart')}
              style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]}>
              <Text style={styles.cartButtonText}>Cart</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Opening shop…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Couldn’t open this shop</Text>
              <Text style={styles.stateDetail}>{loadError}</Text>
              <Pressable onPress={() => router.replace('/')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Explore shops</Text>
              </Pressable>
            </View>
          ) : !shop ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>This shop is no longer available</Text>
              <Text style={styles.stateDetail}>
                Only approved shops are shown in the directory.
              </Text>
              <Pressable onPress={() => router.replace('/')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Explore shops</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.shopBanner}>
                <View style={styles.shopMark}>
                  <Text style={styles.shopMarkText}>
                    {shop.business_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.eyebrow}>FRESHCART SHOP</Text>
                <Text style={styles.shopName}>{shop.business_name}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{shop.business_type || 'Business'}</Text>
                </View>
                <View style={styles.shopDetails}>
                  <Text style={styles.shopDetailLine}>
                    ⌖ {[shop.address, shop.village, shop.taluk, shop.district].filter(Boolean).join(', ') ||
                      'Location not provided'}
                  </Text>
                  {shop.contact_name ? (
                    <Text style={styles.shopDetailLine}>Contact: {shop.contact_name}</Text>
                  ) : null}
                  {shop.contact_phone ? (
                    <Text style={styles.shopDetailLine}>Phone: {shop.contact_phone}</Text>
                  ) : null}
                  {shop.contact_email ? (
                    <Text style={styles.shopDetailLine}>Email: {shop.contact_email}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.catalogHeader}>
                <View>
                  <Text style={styles.catalogTitle}>Shop</Text>
                  <Text style={styles.catalogSubtitle}>
                    {products.length} active {products.length === 1 ? 'product' : 'products'}
                  </Text>
                </View>
              </View>

              {categories.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryChips}>
                  <CategoryChip
                    label="All"
                    selected={selectedCategory === 'all'}
                    onPress={() => setSelectedCategory('all')}
                  />
                  {categories.map((category) => (
                    <CategoryChip
                      key={category.id}
                      label={category.name}
                      selected={selectedCategory === category.id}
                      onPress={() => setSelectedCategory(category.id)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              {cartError ? (
                <Pressable
                  accessibilityRole="alert"
                  onPress={dismissError}
                  style={styles.errorNotice}>
                  <Text style={styles.errorText}>{cartError}</Text>
                  <Text style={styles.dismissText}>×</Text>
                </Pressable>
              ) : null}

              {visibleProducts.length ? (
                <View style={styles.productGrid}>
                  {visibleProducts.map((product) => {
                    const image = imageUrl(product.image_path);
                    return (
                      <View
                        key={product.id}
                        style={[
                          styles.productCard,
                          { flexBasis: isWide ? '31%' : '47%' },
                        ]}>
                        {image ? (
                          <Image
                            accessibilityLabel={product.name}
                            source={{ uri: image }}
                            contentFit="cover"
                            style={styles.productImage}
                          />
                        ) : (
                          <View style={[styles.productImage, styles.imagePlaceholder]}>
                            <Text style={styles.imagePlaceholderText}>✳</Text>
                          </View>
                        )}
                        <View style={styles.productInfo}>
                          <Text style={styles.productCategory}>
                            {categoryNameById.get(product.category_id) ?? 'Shop product'}
                          </Text>
                          <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
                          {product.description ? (
                            <Text numberOfLines={2} style={styles.productDescription}>
                              {product.description}
                            </Text>
                          ) : null}
                          <Text style={styles.productPrice}>
                            ₹{Number(product.price).toLocaleString('en-IN', {
                              maximumFractionDigits: 2,
                            })} <Text style={styles.productUnit}>/ {product.unit}</Text>
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${product.name} to cart`}
                            onPress={() => void addProductToCart(product)}
                            style={({ pressed }) => [
                              styles.addButton,
                              pressed && styles.pressed,
                            ]}>
                            <Text style={styles.addButtonText}>
                              {addedProductId === product.id ? 'Added ✓' : 'Add to cart +'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.stateCard}>
                  <Text style={styles.stateTitle}>
                    {products.length ? 'No products in this category' : 'No products available yet'}
                  </Text>
                  <Text style={styles.stateDetail}>
                    {products.length
                      ? 'Choose another category to view this shop’s products.'
                      : 'This shop has not listed active products yet.'}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.categoryChip, selected && styles.categoryChipSelected]}>
      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f9f6',
  },
  page: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 44,
  },
  content: {
    width: '100%',
    maxWidth: 760,
  },
  contentWide: {
    maxWidth: 1180,
  },
  topbar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
  },
  backText: {
    color: DARK_GREEN,
    fontSize: 24,
    lineHeight: 28,
  },
  backLabel: {
    color: DARK_GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  cartButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#eaf5e9',
  },
  cartButtonText: {
    color: DARK_GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  shopBanner: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4ebe4',
  },
  shopMark: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#eaf5e9',
  },
  shopMarkText: {
    color: DARK_GREEN,
    fontSize: 24,
    fontWeight: '800',
  },
  eyebrow: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  shopName: {
    color: '#18351f',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: 9,
    borderRadius: 20,
    backgroundColor: '#f1f5ef',
  },
  typeBadgeText: {
    color: '#526155',
    fontSize: 10,
    fontWeight: '700',
  },
  shopDetails: {
    alignItems: 'center',
    gap: 5,
    marginTop: 15,
  },
  shopDetailLine: {
    color: '#617064',
    fontSize: 10,
    textAlign: 'center',
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 27,
    marginBottom: 14,
  },
  catalogTitle: {
    color: '#18351f',
    fontSize: 20,
    fontWeight: '800',
  },
  catalogSubtitle: {
    color: '#738075',
    fontSize: 10,
    marginTop: 3,
  },
  categoryChips: {
    gap: 8,
    paddingBottom: 16,
  },
  categoryChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#dce6dc',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  categoryChipSelected: {
    borderColor: GREEN,
    backgroundColor: '#eaf5e9',
  },
  categoryChipText: {
    color: '#667367',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: DARK_GREEN,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0d0ce',
    borderRadius: 10,
    backgroundColor: '#fff0ef',
  },
  errorText: {
    flex: 1,
    color: '#9e3733',
    fontSize: 11,
  },
  dismissText: {
    color: '#9e3733',
    fontSize: 18,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  productCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e4ebe4',
    borderRadius: 15,
    backgroundColor: '#ffffff',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1.45,
    backgroundColor: '#edf3ed',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#9eb49f',
    fontSize: 30,
  },
  productInfo: {
    padding: 12,
  },
  productCategory: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '700',
  },
  productName: {
    color: '#26392c',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  productDescription: {
    color: '#748176',
    fontSize: 9,
    marginTop: 4,
  },
  productPrice: {
    color: DARK_GREEN,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  productUnit: {
    color: '#78857b',
    fontSize: 9,
    fontWeight: '400',
  },
  addButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderRadius: 9,
    backgroundColor: GREEN,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  stateCard: {
    alignItems: 'center',
    padding: 28,
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#e4ebe4',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  stateTitle: {
    color: '#203b27',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateDetail: {
    color: '#718073',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  primaryButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginTop: 16,
    borderRadius: 9,
    backgroundColor: GREEN,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
